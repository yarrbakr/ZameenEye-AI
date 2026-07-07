"""
faster-whisper ASR — real Urdu speech-to-text for WhatsApp voice notes.

Runs on CPU everywhere (small / int8), so the voice loop has no AMD dependency.
The model is lazy-loaded so importing this module does NOT require faster_whisper
to be installed (keeps offline/unit tests importable).
"""
import os
import asyncio
import tempfile

_model = None


def _get_model():
    """Lazily build and cache one WhisperModel (import happens here, not at module load)."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel(
            os.getenv("WHISPER_MODEL", "small"),
            device=os.getenv("WHISPER_DEVICE", "cpu"),
            compute_type=os.getenv("WHISPER_COMPUTE", "int8"),
        )
    return _model


def _transcribe_sync(audio_bytes: bytes, filename: str) -> str:
    """Blocking transcription: write bytes to a temp file, decode, join segment text."""
    suffix = os.path.splitext(filename)[1] or ".ogg"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(audio_bytes)
        tmp.close()
        segments, _info = _get_model().transcribe(
            tmp.name, language=os.getenv("WHISPER_LANG", "ur")
        )
        return "".join(seg.text for seg in segments).strip()
    finally:
        try:
            os.remove(tmp.name)
        except OSError:
            pass


async def transcribe(audio_bytes: bytes, filename: str = "audio.ogg") -> str:
    """Transcribe WhatsApp audio to text; returns "" on any failure (safe fallback)."""
    try:
        return await asyncio.to_thread(_transcribe_sync, audio_bytes, filename)
    except Exception as exc:
        print(f"[asr] transcription failed: {exc}")
        return ""
