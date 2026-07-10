"""Real Urdu ASR test for faster-whisper.

Run (from the repo root):
    .venv\\Scripts\\python.exe python\\voice\\tests\\test_asr_urdu.py
    .venv\\Scripts\\python.exe python\\voice\\tests\\test_asr_urdu.py path\\to\\voice_note.ogg

With no argument it synthesizes a clean Urdu clip via gTTS (a first-pass check).
Pass a REAL WhatsApp voice-note file (.ogg/.opus/.mp3) as the argument to do the
true test. The first run downloads the faster-whisper model (WHISPER_MODEL env,
default 'small'); set WHISPER_MODEL=medium for better Urdu if 'small' is weak.
"""
import sys, os, asyncio, tempfile

try:
    sys.stdout.reconfigure(encoding="utf-8")   # Urdu prints crash on the cp1252 Windows console otherwise
except Exception:
    pass

PYROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, PYROOT)

from voice.asr import transcribe


def _clip():
    if len(sys.argv) > 1:
        path = sys.argv[1]
        with open(path, "rb") as f:
            return f.read(), os.path.basename(path), None
    from gtts import gTTS
    urdu = "میری فصل کو آگ کا خطرہ ہے، مجھے کیا کرنا چاہیے؟"
    mp3 = os.path.join(tempfile.gettempdir(), "urdu_asr_test.mp3")
    gTTS(urdu, lang="ur").save(mp3)
    with open(mp3, "rb") as f:
        return f.read(), "urdu_asr_test.mp3", urdu


audio, fname, expected = _clip()
print(f"[transcribing {fname} ({len(audio)} bytes) with faster-whisper — first run downloads the model]")
out, detected = asyncio.run(transcribe(audio, fname))
has_urdu = any("؀" <= ch <= "ۿ" for ch in out)
if expected:
    print("INPUT (Urdu) :", expected)
print("OUTPUT        :", out)
print("ASR LANG      :", detected)
print("HAS_URDU_SCRIPT:", has_urdu)
print("RESULT:", "PASS - returned Urdu script" if (out and has_urdu) else "CHECK - inspect output above")
