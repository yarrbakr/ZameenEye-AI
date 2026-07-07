"""WhatsApp Cloud API helpers: send text/audio, download inbound media.

All calls use the Graph API. Auth is a Bearer token (WHATSAPP_TOKEN) and the
sender is the test number's phone-number-id (WHATSAPP_PHONE_NUMBER_ID). These
read from the environment on every call so tokens can be rotated without a
restart. Send helpers never raise — they log and return False — so a failed
send can't crash the webhook's background task.
"""
import os

import httpx

GRAPH_VERSION = os.getenv("GRAPH_VERSION", "v22.0")
GRAPH = f"https://graph.facebook.com/{GRAPH_VERSION}"


def _headers() -> dict:
    return {"Authorization": f"Bearer {os.getenv('WHATSAPP_TOKEN', '')}"}


def _messages_url() -> str:
    return f"{GRAPH}/{os.getenv('WHATSAPP_PHONE_NUMBER_ID', '')}/messages"


async def _send(payload: dict) -> bool:
    """POST a message payload to the Cloud API. Logs and returns success."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(_messages_url(), headers=_headers(), json=payload)
        if resp.status_code >= 400:
            print(f"[whatsapp] send failed {resp.status_code}: {resp.text}")
            return False
        return True
    except httpx.HTTPError as exc:
        print(f"[whatsapp] send error: {exc}")
        return False


async def send_text(to: str, body: str) -> bool:
    """Send a plain text message."""
    return await _send({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": body},
    })


async def _upload_media(file_path: str, mime: str = "audio/mpeg") -> str:
    """Upload a local media file to the Cloud API and return its media id.

    POSTs multipart/form-data to /{phone_number_id}/media. Unlike the send
    helpers this MAY raise (on I/O or HTTP error) so the caller can decide how
    to fall back; send_audio wraps it and degrades to text.
    """
    with open(file_path, "rb") as fh:
        file_bytes = fh.read()
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{GRAPH}/{os.getenv('WHATSAPP_PHONE_NUMBER_ID', '')}/media",
            headers=_headers(),
            data={"messaging_product": "whatsapp", "type": mime},
            files={"file": (os.path.basename(file_path), file_bytes, mime)},
        )
    resp.raise_for_status()
    return resp.json()["id"]


async def send_audio(to: str, mp3_path: str) -> bool:
    """Upload an mp3 and send it as a WhatsApp audio message.

    Uploads by id (no public URL needed); mp3/audio/mpeg is an accepted Cloud
    API audio type. Never raises — logs and returns False on any failure.
    """
    try:
        media_id = await _upload_media(mp3_path, "audio/mpeg")
        return await _send({
            "messaging_product": "whatsapp",
            "to": to,
            "type": "audio",
            "audio": {"id": media_id},
        })
    except Exception as exc:  # noqa: BLE001 - mirror _send: never crash the webhook
        print(f"[whatsapp] send_audio error: {exc}")
        return False


async def download_media(media_id: str) -> tuple[bytes, str]:
    """Download inbound media (image/audio) by its media id.

    Two steps, as the Cloud API requires: (1) GET /{media_id} to resolve a
    short-lived download URL, then (2) GET that URL with the Bearer token to
    fetch the bytes. Returns (content_bytes, mime_type).
    """
    async with httpx.AsyncClient(timeout=60) as client:
        meta = await client.get(f"{GRAPH}/{media_id}", headers=_headers())
        meta.raise_for_status()
        info = meta.json()
        media_url = info["url"]
        mime = info.get("mime_type", "")

        resp = await client.get(media_url, headers=_headers())
        resp.raise_for_status()
        return resp.content, mime
