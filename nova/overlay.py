"""
Nova overlay job: the user's own clip with the English and Vietnamese lines burned on. Runs INSIDE the pinned
MoneyPrinterTurbo image (it has python3, Pillow and ffmpeg), with only /work mounted: no Cloudflare token.
Reads /work/jobs/<id>.json and the clip /work/media/<id>/00.<ext>; writes /work/out/<id>.mp4 and
/work/out/<id>.json ({ok, error, duration, footage}).

The look matches the preview in the hub (src/components/NovaClipPreview.tsx): one compact pill near the top edge,
English in white, a hairline, Vietnamese in gold, so the scene underneath stays clear. Slides are spread over the clip
with the same timing as the preview. The clip's own frame rate and picture are kept; the original file is
never touched. With smooth60 set, a clip under 50 fps is interpolated to 60 (ffmpeg minterpolate, slow).
"""
import glob
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

WORK = os.environ.get("NOVA_WORK", "/work")
FONT = os.environ.get("NOVA_FONT", "/MoneyPrinterTurbo/resource/fonts/BeVietnamPro-Bold.ttf")
MAX_SLIDE = 15


def probe(path: str) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "json", path],
        capture_output=True, text=True, check=True,
    ).stdout
    j = json.loads(out)
    num, den = j["streams"][0]["r_frame_rate"].split("/")
    return {"w": int(j["streams"][0]["width"]), "h": int(j["streams"][0]["height"]), "fps": float(num) / float(den or 1), "duration": float(j["format"]["duration"])}


def has_audio(path: str) -> bool:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", path], capture_output=True, text=True).stdout
    return "audio" in out


def read_seconds(en: str, vi: str) -> float:
    n = max(len(en.split()), len(vi.split()))
    return min(8.0, max(3.2, 1.2 + n * 0.33))


def spans(en: list[str], vi: list[str], duration: float) -> list[tuple[float, float]]:
    out, t = [], 0.0
    for a, b in zip(en, vi):
        length = min(MAX_SLIDE, max(read_seconds(a, b), duration / len(en)))
        out.append((t, t + length))
        t += length
    return out


def wrap(draw: ImageDraw.ImageDraw, font: ImageFont.FreeTypeFont, text: str, max_w: float) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        nxt = f"{cur} {word}" if cur else word
        if draw.textlength(nxt, font=font) > max_w and cur:
            lines.append(cur)
            cur = word
        else:
            cur = nxt
    if cur:
        lines.append(cur)
    return lines


def pill(img: Image.Image, en: str, vi: str, top_pct: float) -> None:
    """One compact pill near the top edge: the English line, a hairline, the Vietnamese line. The scene below stays clear."""
    w, h = img.size
    size = round(w * 0.036)
    font = ImageFont.truetype(FONT, size)
    d = ImageDraw.Draw(img)
    pad_x, pad_y = size * 0.9, size * 0.6
    max_w = w * 0.88 - 2 * pad_x
    lh = size * 1.3
    gap = size * 0.7
    en_lines, vi_lines = wrap(d, font, en, max_w), wrap(d, font, vi, max_w)
    text_w = max(d.textlength(l, font=font) for l in en_lines + vi_lines)
    box_w = min(w * 0.88, text_w + 2 * pad_x)
    box_h = (len(en_lines) + len(vi_lines)) * lh + gap + 2 * pad_y
    x0, y0 = (w - box_w) / 2, h * top_pct / 100
    d.rounded_rectangle((x0, y0, x0 + box_w, y0 + box_h), radius=size * 0.55, fill=(6, 10, 22, 128))
    y = y0 + pad_y
    for l in en_lines:
        d.text((w / 2, y + lh / 2), l, font=font, fill=(245, 241, 230, 255), anchor="mm")
        y += lh
    d.line((w / 2 - box_w * 0.18, y + gap / 2, w / 2 + box_w * 0.18, y + gap / 2), fill=(255, 255, 255, 70), width=max(1, size // 18))
    y += gap
    for l in vi_lines:
        d.text((w / 2, y + lh / 2), l, font=font, fill=(232, 196, 119, 255), anchor="mm")
        y += lh


def slide_png(path: str, en: str, vi: str, w: int, h: int, top_pct: float = 6) -> None:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pill(img, en, vi, top_pct)
    img.save(path)


def main(job_id: str) -> None:
    out_json = f"{WORK}/out/{job_id}.json"
    os.makedirs(f"{WORK}/out", exist_ok=True)
    try:
        job = json.load(open(f"{WORK}/jobs/{job_id}.json"))
        clips = sorted(glob.glob(f"{WORK}/media/{job_id}/00.*"))
        if not clips:
            raise RuntimeError("the clip is gone (uploads are kept 3 days)")
        clip = clips[0]
        en, vi = job["lines"], job.get("viLines") or []
        n = min(len(en), len(vi))
        if not n:
            raise RuntimeError("no lines to put on the clip")
        en, vi = en[:n], vi[:n]
        info = probe(clip)
        tmp = f"{WORK}/tmp/{job_id}"
        os.makedirs(tmp, exist_ok=True)
        times = spans(en, vi, info["duration"])
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", clip]
        for i in range(n):
            png = f"{tmp}/s{i}.png"
            slide_png(png, en[i], vi[i], info["w"], info["h"], float(job.get("textTop") or 6))
            cmd += ["-i", png]
        chain, last = [], "0:v"
        if job.get("smooth60") and info["fps"] < 50:
            chain.append(f"[0:v]minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:vsbmc=1[base]")
            last = "base"
        for i, (a, b) in enumerate(times):
            chain.append(f"[{last}][{i + 1}:v]overlay=0:0:enable='between(t,{a:.3f},{b:.3f})'[v{i}]")
            last = f"v{i}"
        cmd += ["-filter_complex", ";".join(chain), "-map", f"[{last}]"]
        if has_audio(clip):
            cmd += ["-map", "0:a", "-c:a", "copy"]
        cmd += ["-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{WORK}/out/{job_id}.mp4"]
        subprocess.run(cmd, check=True)
        res = probe(f"{WORK}/out/{job_id}.mp4")
        json.dump({"ok": True, "duration": res["duration"], "footage": "upload", "fps": res["fps"]}, open(out_json, "w"))
    except Exception as e:  # noqa: BLE001
        json.dump({"ok": False, "error": str(e)[:300]}, open(out_json, "w"))
        raise


if __name__ == "__main__":
    main(sys.argv[1])
