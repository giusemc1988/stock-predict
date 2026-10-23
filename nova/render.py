"""
Nova render job. Runs INSIDE the pinned MoneyPrinterTurbo image (nova/upstream.json), with only
/work mounted: no Cloudflare token, no repo checkout. Reads /work/jobs/<id>.json, writes
/work/out/<id>.mp4 and /work/out/<id>.json ({ok, error, duration, footage}).

Nova already wrote the script (Gemini/Groq on the Worker), so MoneyPrinterTurbo needs no LLM:
we hand it the lines and the search terms. Voice and subtitle timing come from Edge TTS (free).
Footage: Pexels when a free key was saved in Nova, otherwise public-domain photos from
Openverse (CC0 / PDM, no key, no credit needed) turned into slow zoom clips.
"""
import json
import os
import shutil
import sys

ROOT = "/MoneyPrinterTurbo"
WORK = "/work"
FONT = "BeVietnamPro-Bold.ttf"
VOICES = {
    ("vi", "female"): "vi-VN-HoaiMyNeural-Female",
    ("vi", "male"): "vi-VN-NamMinhNeural-Male",
    ("en", "female"): "en-US-JennyNeural-Female",
    ("en", "male"): "en-US-GuyNeural-Male",
}
OPENVERSE_ASPECT = {"9:16": "tall", "16:9": "wide", "1:1": "square"}
MAX_PHOTOS = 12
# photo URLs already saved, so the any-shape second pass does not repeat the first
_SEEN: set[str] = set()
# Openverse terms that timed out twice; after 2 we stop asking it (a slow Openverse would cost 20+ minutes)
_DOWN = [0]


def write_config(pexels_key: str) -> None:
    """config.toml must exist before any app module is imported (they read it at import time)."""
    import toml

    cfg = toml.load(f"{ROOT}/config.example.toml")
    app = cfg.setdefault("app", {})
    app["pexels_api_keys"] = [pexels_key] if pexels_key else []
    app["subtitle_provider"] = "edge"
    app["enable_redis"] = False
    cfg.setdefault("ui", {})["font_name"] = FONT
    with open(f"{ROOT}/config.toml", "w", encoding="utf-8") as f:
        toml.dump(cfg, f)


def openverse_photos(terms: list[str], aspect: str | None, dest: str) -> list[str]:
    """Large CC0 / public-domain photographs for the terms, saved into MoneyPrinterTurbo's local folder.
    category=photograph keeps out museum scans (paintings, quilts) that match a word but not the story."""
    import requests

    os.makedirs(dest, exist_ok=True)
    headers = {"User-Agent": "Nova-Video-Studio/1.0 (+https://github.com/giusemc1988/stock-predict)"}
    files: list[str] = []
    for term in terms:
        if len(files) >= MAX_PHOTOS or _DOWN[0] >= 2:
            break
        results = None
        for attempt in range(2):
            try:
                r = requests.get(
                    "https://api.openverse.org/v1/images/",
                    params={"q": term, "license": "cc0,pdm", "category": "photograph", "size": "large", "page_size": 6, "mature": "false", **({"aspect_ratio": OPENVERSE_ASPECT.get(aspect, "tall")} if aspect else {})},
                    headers=headers,
                    timeout=45,
                )
                results = r.json().get("results", []) if r.ok else []
                break
            except Exception as exc:  # noqa: BLE001 - Openverse is often slow; one bad term must not stop the video
                print(f"openverse: {term!r} try {attempt + 1} failed: {exc}")
        if results is None:
            _DOWN[0] += 1
            continue
        for item in results[:3]:
            url = item.get("url") or ""
            if not url or url in _SEEN or (item.get("width") or 0) < 720 or (item.get("height") or 0) < 720:
                continue
            _SEEN.add(url)
            try:
                img = requests.get(url, headers=headers, timeout=30)
                if not img.ok or not img.headers.get("content-type", "").startswith("image/"):
                    continue
            except Exception:  # noqa: BLE001
                continue
            name = f"nova-{len(os.listdir(dest)):02d}.jpg"
            with open(os.path.join(dest, name), "wb") as f:
                f.write(img.content)
            files.append(name)
            if len(files) >= MAX_PHOTOS:
                break
    return files


def gradient_backgrounds(aspect: str, dest: str, count: int = 5) -> list[str]:
    """Last resort when no photo source answers: calm Nova-coloured gradients, so the voice and subtitles still ship."""
    from PIL import Image

    w, h = (1080, 1920) if aspect == "9:16" else (1920, 1080) if aspect == "16:9" else (1080, 1080)
    palette = [((11, 21, 48), (201, 162, 39)), ((8, 30, 60), (64, 140, 180)), ((20, 12, 40), (150, 90, 160)), ((6, 40, 40), (60, 160, 120)), ((30, 20, 10), (210, 120, 60))]
    os.makedirs(dest, exist_ok=True)
    files = []
    for i in range(count):
        top, bottom = palette[i % len(palette)]
        col = Image.new("RGB", (1, 256))
        for y in range(256):
            t = y / 255
            col.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
        name = f"nova-bg-{i}.jpg"
        col.resize((w, h), Image.BICUBIC).save(os.path.join(dest, name), quality=92)
        files.append(name)
    return files


def uploads(job_id: str) -> list[str]:
    """Files nova/queue.mjs downloaded for this job (the user's own footage), sorted by their order."""
    folder = f"{WORK}/media/{job_id}"
    if not os.path.isdir(folder):
        return []
    return [os.path.join(folder, n) for n in sorted(os.listdir(folder)) if os.path.splitext(n)[1].lower() in (".jpg", ".png", ".webp", ".mp4", ".mov", ".webm")]


def opt(opts: dict, key: str, default, lo=None, hi=None):
    """One setting from Nova's video settings (job["opts"]); a missing or odd value keeps Nova's default."""
    v = opts.get(key, default)
    if isinstance(default, bool):
        return v if isinstance(v, bool) else default
    if isinstance(default, (int, float)):
        if not isinstance(v, (int, float)) or isinstance(v, bool):
            return default
        return max(lo, min(hi, v)) if lo is not None else v
    return v if isinstance(v, str) and v else default


def render(job: dict, pexels_key: str) -> dict:
    from app.models.schema import MaterialInfo, VideoParams
    from app.services import state as sm
    from app.services import task as tm
    from app.utils import utils

    aspect = job.get("aspect") if job.get("aspect") in ("9:16", "16:9", "1:1") else "9:16"
    o = job.get("opts") if isinstance(job.get("opts"), dict) else {}
    transition = opt(o, "transition", "none")
    sub_mode = opt(o, "subMode", "sentence")
    terms = [t for t in job.get("terms", []) if t][:8] or [job["topic"]]
    own = uploads(job["id"])
    source = "pexels" if pexels_key and not own else "local"
    footage = "pexels"
    materials = None
    if own:
        # the user's own photos and clips, in the order they picked them
        folder = utils.storage_dir("local_videos", create=True)
        names = []
        for i, path in enumerate(own):
            name = f"nova-own-{i:02d}{os.path.splitext(path)[1]}"
            shutil.copyfile(path, os.path.join(folder, name))
            names.append(name)
        footage = "upload"
        materials = [MaterialInfo(provider="local", url=n) for n in names]
    elif source == "local":
        folder = utils.storage_dir("local_videos", create=True)
        photos = openverse_photos(terms, aspect, folder)
        if len(photos) < 3:
            # few photos in this shape: take any shape, the "cover" fit crops them
            photos += openverse_photos(terms, None, folder)[: MAX_PHOTOS - len(photos)]
        footage = "openverse"
        if not photos:
            print("openverse gave no photos: using plain gradient backgrounds")
            photos = gradient_backgrounds(aspect, folder)
            footage = "gradient"
        materials = [MaterialInfo(provider="local", url=p) for p in photos]

    params = VideoParams(
        video_subject=job["topic"],
        video_script="\n".join(job["lines"]),
        video_terms=terms,
        video_aspect=aspect,
        video_source=source,
        video_materials=materials,
        video_clip_duration=int(opt(o, "clip", 4, 2, 8)),
        video_concat_mode="sequential" if source == "local" else "random",
        video_transition_mode=transition if transition in ("FadeIn", "SlideIn", "ZoomIn", "Shuffle") else None,
        video_language="vi-VN" if job["lang"] == "vi" else "en-US",
        voice_name=VOICES.get((job["lang"], job.get("voice", "female")), VOICES[("vi", "female")]),
        voice_rate=float(opt(o, "voiceRate", 1.0, 0.7, 1.5)),
        voice_volume=float(opt(o, "voiceVolume", 1.0, 0.5, 1.5)),
        bgm_type="random" if opt(o, "music", True) else "",
        bgm_volume=float(opt(o, "musicVolume", 0.15, 0.0, 0.5)),
        subtitle_enabled=True,
        subtitle_position="custom",
        custom_position=float(opt(o, "subPos", 72.0, 10, 90)),
        subtitle_display_mode=sub_mode if sub_mode in ("sentence", "word_by_word") else "sentence",
        subtitle_animation="pop_spring" if opt(o, "subPop", False) else "none",
        font_name=FONT,
        font_size=int(opt(o, "subSize", 64 if aspect == "9:16" else 56, 36, 110)),
        text_fore_color=opt(o, "subColor", "#FFFFFF"),
        text_background_color="#000000" if opt(o, "subBox", False) else False,
        rounded_subtitle_background=bool(opt(o, "subBox", False)),
        stroke_color="#000000",
        stroke_width=float(opt(o, "subStroke", 2.0, 0, 5)),
        n_threads=4,
    )
    result = tm.start(job["id"], params, stop_at="video")
    videos = (result or {}).get("videos") or []
    if not videos:
        task = sm.state.get_task(job["id"]) or {}
        stage = task.get("failed_stage") or "video"
        return {"ok": False, "error": f"{stage}: {task.get('error') or 'MoneyPrinterTurbo made no video'}"}
    shutil.copyfile(videos[0], f"{WORK}/out/{job['id']}.mp4")
    return {"ok": True, "duration": (result or {}).get("audio_duration"), "footage": footage}


def main() -> int:
    job_id = sys.argv[1]
    with open(f"{WORK}/jobs/{job_id}.json", encoding="utf-8") as f:
        job = json.load(f)
    key_file = f"{WORK}/pexels.txt"
    pexels_key = open(key_file, encoding="utf-8").read().strip() if os.path.exists(key_file) else ""
    os.makedirs(f"{WORK}/out", exist_ok=True)
    write_config(pexels_key)
    sys.path.insert(0, ROOT)
    os.chdir(ROOT)
    try:
        out = render(job, pexels_key)
    except Exception as exc:  # noqa: BLE001 - report every failure back to Nova
        out = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
    out["error"] = (out.get("error") or "")[:300] or None
    with open(f"{WORK}/out/{job_id}.json", "w", encoding="utf-8") as f:
        json.dump(out, f)
    print(json.dumps(out))
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
