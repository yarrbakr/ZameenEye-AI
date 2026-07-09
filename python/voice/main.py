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
from .pipeline import run as run_pipeline  # noqa: E402
from .whatsapp import download_media, send_audio, send_text  # noqa: E402

app = FastAPI(title="ZameenEye Voice")

# Strong refs to in-flight background tasks. asyncio only keeps weak refs to
# tasks, so without this a task can be garbage-collected mid-flight. We add on
# dispatch and discard on completion.
_inflight: set[asyncio.Task] = set()


# ===================== MESSAGE HANDLING =====================

async def handle_message(msg: dict) -> None:
    """Process one inbound WhatsApp message end to end (runs in the background)."""
    phone = msg.get("from")
    if not phone:
        return
    mtype = msg.get("type")

    try:
        if mtype == "audio":
            content, _ = await download_media(msg["audio"]["id"])
            transcript = await transcribe(content, "audio.ogg")
            print(f"[voice transcript] {transcript!r}")
            if not transcript:
                await send_text(phone, "Sorry, I couldn't catch that — please resend the voice note.")
                return
            mp3 = await run_pipeline(phone, transcript)
        elif mtype == "text":
            mp3 = await run_pipeline(phone, msg["text"]["body"])
        else:
            await send_text(phone, "Send me a voice note or a text about your land and I'll check it for hazards.")
            return

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
