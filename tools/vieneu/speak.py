"""Text to a 48 kHz WAV with VieNeu-TTS v3 Turbo on CPU (no GPU, no API key).

  python tools/vieneu/speak.py --text "Xin chào" --voice "Hải Đăng" --out voice.wav
  python tools/vieneu/speak.py --text-file script.txt --out voice.wav
  python tools/vieneu/speak.py --list

VieNeu splits long text into sentences itself, so a whole script goes in one call.
The model (~0.1B, Apache-2.0) downloads from Hugging Face on first use.
"""
import argparse
import sys
import time
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--text', default='')
    ap.add_argument('--text-file', default='')
    ap.add_argument('--voice', default='Hải Đăng', help='preset voice name, see --list')
    ap.add_argument('--out', default='voice.wav')
    ap.add_argument('--list', action='store_true', help='print the preset voices and stop')
    a = ap.parse_args()

    from vieneu import Vieneu

    tts = Vieneu()
    try:
        if a.list:
            for desc, _name in tts.list_preset_voices():
                print(desc)
            return 0
        text = Path(a.text_file).read_text(encoding='utf-8') if a.text_file else a.text
        if not text.strip():
            print('Nothing to read: give --text or --text-file', file=sys.stderr)
            return 2
        names = [n for _, n in tts.list_preset_voices()]
        if a.voice not in names:
            print(f'Unknown voice "{a.voice}". Voices: {", ".join(names)}', file=sys.stderr)
            return 2
        t0 = time.time()
        audio = tts.infer(text, voice=a.voice)
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        tts.save(audio, a.out)
        secs = len(audio) / tts.sample_rate
        print(f'{len(text)} chars in {time.time() - t0:.1f} s of work -> {a.out}: {secs:.1f} s')
        return 0
    finally:
        tts.close()


if __name__ == '__main__':
    sys.exit(main())
