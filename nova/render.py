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
        if len(files) >= MAX_PHOTOS:
            break
        try:
            r = requests.get(
                "https://api.openverse.org/v1/images/",
                params={"q": term, "license": "cc0,pdm", "category": "photograph", "size": "large", "page_size": 6, "mature": "false", **({"aspect_ratio": OPENVERSE_ASPECT.get(aspect, "tall")} if aspect else {})},
                headers=headers,
                timeout=20,
            )
            results = r.json().get("results", []) if r.ok else []
        except Exception as exc:  # noqa: BLE001 - one bad term must not stop the video
            print(f"openverse: {term!r} failed: {exc}")
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


def render(job: dict, pexels_key: str) -> dict:
    from app.models.schema import MaterialInfo, VideoParams
    from app.services import state as sm
    from app.services import task as tm
    from app.utils import utils

    aspect = job.get("aspect") if job.get("aspect") in ("9:16", "16:9", "1:1") else "9:16"
    terms = [t for t in job.get("terms", []) if t][:8] or [job["topic"]]
    source = "pexels" if pexels_key else "local"
    materials = None
    if source == "local":
        folder = utils.storage_dir("local_videos", create=True)
        photos = openverse_photos(terms, aspect, folder)
        if len(photos) < 3:
            # few photos in this shape: take any shape, the "cover" fit crops them
            photos += openverse_photos(terms, None, folder)[: MAX_PHOTOS - len(photos)]
        if not photos:
            return {"ok": False, "error": "No footage: Openverse returned no photos and no Pexels key is saved."}
        materials = [MaterialInfo(provider="local", url=p) for p in photos]

    params = VideoParams(
        video_subject=job["topic"],
        video_script="\n".join(job["lines"]),
        video_terms=terms,
        video_aspect=aspect,
        video_source=source,
        video_materials=materials,
        video_clip_duration=4,
        video_concat_mode="sequential" if source == "local" else "random",
        video_language="vi-VN" if job["lang"] == "vi" else "en-US",
        voice_name=VOICES.get((job["lang"], job.get("voice", "female")), VOICES[("vi", "female")]),
        voice_rate=1.0,
        bgm_type="random",
        bgm_volume=0.15,
        subtitle_enabled=True,
        subtitle_position="custom",
        custom_position=72.0,
        font_name=FONT,
        font_size=64 if aspect == "9:16" else 56,
        text_fore_color="#FFFFFF",
        stroke_color="#000000",
        stroke_width=2.0,
        n_threads=4,
    )
    result = tm.start(job["id"], params, stop_at="video")
    videos = (result or {}).get("videos") or []
    if not videos:
        task = sm.state.get_task(job["id"]) or {}
        stage = task.get("failed_stage") or "video"
        return {"ok": False, "error": f"{stage}: {task.get('error') or 'MoneyPrinterTurbo made no video'}"}
    shutil.copyfile(videos[0], f"{WORK}/out/{job['id']}.mp4")
    return {"ok": True, "duration": (result or {}).get("audio_duration"), "footage": "pexels" if pexels_key else "openverse"}


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
