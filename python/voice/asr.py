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


def _transcribe_sync(audio_bytes: bytes, filename: str) -> tuple[str, str]:
    """Blocking transcription. Returns (text, detected_language_code).

    WHISPER_LANG unset or "auto" -> let Whisper auto-detect the language, so an
    English voice note is recognized as English instead of being force-decoded into
    Urdu script. Set WHISPER_LANG to a concrete code (e.g. "ur") to hard-pin it.
    """
    suffix = os.path.splitext(filename)[1] or ".ogg"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(audio_bytes)
        tmp.close()
        hint = os.getenv("WHISPER_LANG", "").strip().lower()
        lang_arg = None if hint in ("", "auto") else hint
        segments, info = _get_model().transcribe(tmp.name, language=lang_arg)
        text = "".join(seg.text for seg in segments).strip()
        return text, (getattr(info, "language", "") or "")
    finally:
        try:
            os.remove(tmp.name)
        except OSError:
            pass


async def transcribe(audio_bytes: bytes, filename: str = "audio.ogg") -> tuple[str, str]:
    """Transcribe WhatsApp audio; returns (text, detected_lang). ("", "") on failure."""
    try:
        return await asyncio.to_thread(_transcribe_sync, audio_bytes, filename)
    except Exception as exc:
        print(f"[asr] transcription failed: {exc}")
        return "", ""
