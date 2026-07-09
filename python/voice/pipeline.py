"""
Voice pipeline glue: phone -> land -> /spatial-check -> HazardPayload -> Fireworks -> gTTS.

Runs with python/ as cwd, so the absolute `inference.` / `tts.` imports resolve.
Returns an mp3 path (for the caller to send via WhatsApp), or None on any failure.
"""
import os
import asyncio
import tempfile

import httpx

from .resolver import resolve_land_id
from inference.fireworks_client import generate_advisory
from tts.text_to_speech import synthesize_advisory

SPATIAL_CHECK_URL = os.getenv("SPATIAL_CHECK_URL", "http://localhost:3000/spatial-check")


def to_hazard_payload(spatial: dict) -> dict:
    """Bridge Kai's /spatial-check output to Sabrith's HazardPayload input shape."""
    owner = spatial.get("owner", {}) or {}
    # owner.preferred_language may be null but the schema needs a non-null literal
    # -> default "urdu" (PK market).
    lang = owner.get("preferred_language") or "urdu"
    events = []
    for e in spatial.get("intersecting_events", []) or []:
        rp = e.get("raw_payload", {}) or {}
        # HazardPayload.IntersectingEvent requires `detected_at`. Kai's documented
        # contract puts it at the event top level and/or inside the normalized
        # raw_payload, but the live service may omit it. Prefer top-level, then
        # raw_payload (normalized `detected_at`, or raw FIRMS `acq_date`), then the
        # check time as a last resort.
        detected_at = (
            e.get("detected_at")
            or rp.get("detected_at")
            or rp.get("acq_date")
            or spatial.get("checked_at", "")
        )
        events.append(
            {
                "source": e.get("source", ""),
                "detected_at": detected_at,
                "raw_payload": rp,
            }
        )
    return {
        "land": spatial.get("land", {}) or {},
        "owner": {
            "name": owner.get("name", ""),
            "phone_number": owner.get("phone_number", ""),
            "role": owner.get("role", "farmer"),
            "preferred_language": lang,
        },
        "has_active_hazard": bool(spatial.get("has_active_hazard", False)),
        "intersecting_events": events,
    }


async def run(phone: str, text: str) -> str | None:
    """Full voice loop for one message; returns the advisory mp3 path or None."""
    # `text` is the farmer's transcribed question. We hand it to generate_advisory
    # so the LLM answers THEIR specific question, grounded in the land's live
    # hazard state (fetched below). Blank text -> generate_advisory falls back to a
    # plain hazard status report (byte-identical to the old land-only behaviour).
    # resolve_land_id may hit the DB via SYNCHRONOUS psycopg — offload to a thread
    # so it never blocks the event loop (a blocking call freezes the whole loop,
    # stalling the webhook ACK and every other in-flight request).
    land_id = await asyncio.to_thread(resolve_land_id, phone)
    if not land_id:
        print(f"[pipeline] no land mapped for {phone}")
        return None
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(SPATIAL_CHECK_URL, json={"landId": land_id})
            resp.raise_for_status()
            spatial = resp.json()
    except Exception as exc:
        print(f"[pipeline] spatial-check failed: {exc}")
        return None
    payload = to_hazard_payload(spatial)
    advisory = await asyncio.to_thread(generate_advisory, payload, text)
    if advisory is None:
        print("[pipeline] generate_advisory returned None")
        return None
    out_path = os.path.join(tempfile.gettempdir(), f"advisory_{phone}.mp3")
    try:
        return await asyncio.to_thread(synthesize_advisory, advisory, out_path)
    except Exception as exc:
        print(f"[pipeline] tts failed: {exc}")
        return None
