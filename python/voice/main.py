"""FastAPI WhatsApp webhook — the front door for the ZameenEye voice service.

Meta's WhatsApp Cloud API calls this:
  • GET  /webhook  -> one-time verification handshake
  • POST /webhook  -> inbound messages (voice note / text)

We ACK every POST with 200 immediately and do the real work in a background task
(Meta retries on a non-200 or a slow ack, so we must not block on it). A voice
note is downloaded from Meta, transcribed (ASR), run through the hazard pipeline,
and answered with an Urdu audio advisory.
"""
import asyncio
import os
import sys

# Windows consoles default to cp1252 and raise UnicodeEncodeError when we log
# Urdu/Hindi text (transcripts, advisories). Force UTF-8 so a debug print can
# never crash a message handler — which would otherwise drop a good reply to the
# error fallback purely because of console encoding.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:  # noqa: BLE001 - not every stream supports reconfigure
        pass

from dotenv import load_dotenv  # noqa: E402

# Load .env BEFORE importing .pipeline: it pulls in inference.fireworks_client,
# which reads FIREWORKS_API_KEY from the environment at import time.
load_dotenv()

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.responses import PlainTextResponse  # noqa: E402

from .asr import transcribe  # noqa: E402
from .pipeline import detect_lang, extract_area, run as run_pipeline, speak, synthesize  # noqa: E402
from .whatsapp import download_media, send_audio, send_text  # noqa: E402

app = FastAPI(title="ZameenEye Voice")

# Strong refs to in-flight background tasks. asyncio only keeps weak refs to
# tasks, so without this a task can be garbage-collected mid-flight. We add on
# dispatch and discard on completion.
_inflight: set[asyncio.Task] = set()


# ===================== MESSAGE HANDLING =====================

# ---- lightweight per-user conversation state (in-memory; resets on restart) ----
_SESSIONS: dict[str, dict] = {}


def _session(phone: str) -> dict:
    return _SESSIONS.setdefault(
        phone, {"greeted": False, "area": None, "awaiting_area": False}
    )


# Greeting + area prompt, per language, delivered as a VOICE note. We keep the
# framing general (hazards near your land/area), not wildfire-only.
_GREET_ASK = {
    "ur": "السلام علیکم! میں زمین آئی ہوں، ایک آواز پر مبنی معاون جو آپ کی زمین اور علاقے کے قریب خطرات کی جانچ کرتا ہوں۔ براہِ کرم بتائیں، آپ کس علاقے سے تعلق رکھتے ہیں؟",
    "en": "Assalam o Alaikum! I'm ZameenEye, a voice assistant that checks for hazards near your land and area. Please tell me, which area are you from?",
}
_GREET_ONLY = {
    "ur": "السلام علیکم! میں زمین آئی ہوں، آپ کی زمین اور علاقے کے قریب خطرات کی جانچ کرنے والا آواز معاون۔",
    "en": "Assalam o Alaikum! I'm ZameenEye, your voice assistant for checking hazards near your land and area.",
}
_ASK_AREA = {
    "ur": "براہِ کرم اپنے علاقے کا نام بتائیں تاکہ میں آپ کی مدد کر سکوں۔",
    "en": "Please tell me your area name so I can help you.",
}


def _clean_area(text: str) -> str | None:
    t = (text or "").strip()
    return t[:60] if t else None


async def _send_voice(phone: str, text: str, lang: str) -> None:
    """Speak `text` as a voice note; fall back to a text message if TTS fails."""
    mp3 = await speak(text, lang, phone)
    if mp3:
        await send_audio(phone, mp3)
    else:
        await send_text(phone, text)


def _resolve_voice_lang(detected: str, transcript: str) -> str:
    """Urdu-biased language pick for a VOICE note: reply in English only when the
    transcript is clearly Latin-script AND Whisper detected English. Anything with
    Urdu script (or Hindi / other / uncertain) -> Urdu. Protects the Urdu demo from
    a mis-detection flipping it to English."""
    if detected == "en" and detect_lang(transcript) == "en":
        return "en"
    return "ur"


async def handle_message(msg: dict) -> None:
    """Process one inbound WhatsApp message end to end (runs in the background).

    Conversation flow: first contact -> greet + ask the user's area (voice note);
    once the area is known -> hazard advisory addressing that area. Reply language
    follows the message (default Urdu): Urdu -> voice, English -> text. Hard error
    fallbacks stay in English.
    """
    phone = msg.get("from")
    if not phone:
        return
    mtype = msg.get("type")

    try:
        # --- 1. Pull the message text + pick the reply language ---
        if mtype == "audio":
            content, _ = await download_media(msg["audio"]["id"])
            transcript, detected = await transcribe(content, "audio.ogg")
            print(f"[voice transcript] {transcript!r} (asr lang={detected})")
            if not transcript:
                await send_text(phone, "Sorry, I couldn't catch that — please resend the voice note.")
                return
            text, lang = transcript, _resolve_voice_lang(detected, transcript)
        elif mtype == "text":
            text = msg["text"]["body"]
            lang = detect_lang(text)
        else:
            await send_text(phone, "Send me a voice note or a text about your land and I'll check it for hazards.")
            return

        session = _session(phone)

        # --- 2. Remember any area named in this message ---
        found = extract_area(text)
        if found:
            session["area"] = found
            session["awaiting_area"] = False

        # --- 3. First contact: greet (voice); ask for the area if we don't have it ---
        if not session["greeted"]:
            session["greeted"] = True
            if session["area"] is None:
                session["awaiting_area"] = True
                await _send_voice(phone, _GREET_ASK[lang], lang)
                return
            await _send_voice(phone, _GREET_ONLY[lang], lang)
            # they named an area up front -> fall through to the advisory
        elif session["area"] is None:
            # returning user we still don't have an area for
            if session["awaiting_area"]:
                session["area"] = _clean_area(text)      # their reply IS the area
                session["awaiting_area"] = False
            if session["area"] is None:
                session["awaiting_area"] = True
                await _send_voice(phone, _ASK_AREA[lang], lang)
                return

        # --- 4. Area known -> advisory, addressing their area ---
        advisory = await run_pipeline(phone, text, lang, area=session["area"])
        if advisory is None:
            await send_text(phone, "Sorry, I couldn't build your advisory just now. Please try again shortly.")
            return

        if advisory.language == "en":
            # English -> English TEXT reply (advice + one next step).
            reply = advisory.advisory_text
            if advisory.recommended_action:
                reply = f"{reply}\n\n{advisory.recommended_action}"
            await send_text(phone, reply)
        else:
            # Urdu (and any non-English) -> Urdu VOICE reply.
            mp3 = await synthesize(advisory, phone)
            if mp3:
                await send_audio(phone, mp3)
            else:
                await send_text(phone, "Sorry, I couldn't build your advisory just now. Please try again shortly.")
    except Exception as exc:  # noqa: BLE001 - keep the webhook resilient
        print(f"[webhook] error handling {mtype} from {phone}: {exc}")
        try:
            await send_text(phone, "Sorry, something went wrong on our side. Please try again in a moment.")
        except Exception:  # noqa: BLE001
            pass


# ===================== ROUTES =====================

@app.get("/")
async def root():
    return {"status": "ok", "service": "zameeneye-voice"}


@app.get("/webhook")
async def verify(request: Request):
    """Meta's verification handshake: echo hub.challenge when the token matches."""
    params = request.query_params
    if (params.get("hub.mode") == "subscribe"
            and params.get("hub.verify_token") == os.getenv("WHATSAPP_VERIFY_TOKEN")):
        return PlainTextResponse(params.get("hub.challenge", ""), status_code=200)
    return PlainTextResponse("Forbidden", status_code=403)


@app.post("/webhook")
async def receive(request: Request):
    """Receive inbound messages; ACK 200 fast and process in the background.

    We dispatch each message with asyncio.create_task (NOT Starlette
    BackgroundTasks): a BackgroundTask runs *before* the response is released to
    the client, so the ACK would block on the whole voice loop (media download +
    ASR + spatial-check + Fireworks + gTTS + send — tens of seconds). Meta times
    out webhooks in a few seconds and retries on timeout, causing duplicate
    processing. create_task detaches the work so we ACK 200 immediately.
    """
    try:
        data = await request.json()
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for msg in value.get("messages", []):
                    task = asyncio.create_task(handle_message(msg))
                    _inflight.add(task)
                    task.add_done_callback(_inflight.discard)
    except Exception as exc:  # noqa: BLE001 - always ACK so Meta doesn't retry-storm
        print(f"[webhook] parse error: {exc}")
    return PlainTextResponse("OK", status_code=200)
