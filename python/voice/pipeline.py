"""
Voice pipeline glue: phone -> land -> /spatial-check -> HazardPayload -> Fireworks -> gTTS.

Runs with python/ as cwd, so the absolute `inference.` / `tts.` imports resolve.
Returns an mp3 path (for the caller to send via WhatsApp), or None on any failure.
"""
import os
import re
import asyncio
import tempfile

import httpx

from .resolver import resolve_land_id
from inference.fireworks_client import generate_advisory
from tts.text_to_speech import synthesize_advisory
from prompts.schema import AgriAdvisory

SPATIAL_CHECK_URL = os.getenv("SPATIAL_CHECK_URL", "http://localhost:3000/spatial-check")

# Urdu/Arabic script Unicode blocks — presence of any of these => the message is Urdu.
_URDU_SCRIPT = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")
# code -> the schema's preferred_language string
_LANG_TO_PREF = {"ur": "urdu", "en": "english"}


def detect_lang(text: str) -> str:
    """Cheap script-based language pick for a text message.

    Urdu/Arabic script -> 'ur'; otherwise Latin letters -> 'en'; empty/other -> 'ur'
    (Pakistan-market default). Urdu-biased on purpose: only clearly-Latin text
    replies in English.
    """
    if text and _URDU_SCRIPT.search(text):
        return "ur"
    if text and re.search(r"[A-Za-z]", text):
        return "en"
    return "ur"


# Known Pakistani areas (English + Urdu script) for spotting an area in a message.
# Values are surface forms; we return the one that matched so it stays in-language.
_AREAS = {
    "Multan": ["multan", "ملتان"],
    "Lahore": ["lahore", "لاہور"],
    "Karachi": ["karachi", "کراچی"],
    "Islamabad": ["islamabad", "اسلام آباد", "اسلام اباد"],
    "Rawalpindi": ["rawalpindi", "راولپنڈی", "پنڈی"],
    "Faisalabad": ["faisalabad", "فیصل آباد", "فیصل اباد"],
    "Peshawar": ["peshawar", "پشاور"],
    "Quetta": ["quetta", "کوئٹہ"],
    "Hyderabad": ["hyderabad", "حیدرآباد", "حیدر آباد"],
    "Sialkot": ["sialkot", "سیالکوٹ"],
    "Gujranwala": ["gujranwala", "گوجرانوالہ"],
    "Bahawalpur": ["bahawalpur", "بہاولپور"],
    "Sargodha": ["sargodha", "سرگودھا"],
    "Sukkur": ["sukkur", "سکھر"],
    "Sahiwal": ["sahiwal", "ساہیوال"],
    "Okara": ["okara", "اوکاڑہ"],
}


def extract_area(text: str) -> str | None:
    """Return a known area named in `text` (surface form as written), else None."""
    if not text:
        return None
    low = text.lower()
    for aliases in _AREAS.values():
        for alias in aliases:
            if alias.lower() in low:
                # Title-case Latin names; leave Urdu-script names as-is.
                return alias.title() if alias.isascii() else alias
    return None


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


async def run(phone: str, text: str, lang: str = "ur", area: str | None = None) -> AgriAdvisory | None:
    """Resolve land -> /spatial-check -> advisory in `lang`. Returns the advisory
    object (the CALLER decides audio vs text reply); None on any failure.

    `text` is the farmer's message (transcribed voice note or typed text); `lang`
    ("ur"/"en") is the language they used — we reply in it, overriding the stored
    preference. `area` (if known) is the user's stated area, folded into the question
    so the advisory addresses it by name (the hazard data itself stays land-based).
    resolve_land_id may hit the DB via SYNCHRONOUS psycopg -> offload to a thread so
    it never blocks the event loop (a blocking call stalls the webhook ACK).
    """
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
    # Reply in the language the farmer used (default urdu), overriding the stored pref.
    payload["owner"]["preferred_language"] = _LANG_TO_PREF.get(lang, "urdu")
    # Give the LLM the user's area so it addresses it by name in the reply.
    question = f"{text}\n\n[User's area: {area}]" if area else text
    advisory = await asyncio.to_thread(generate_advisory, payload, question)
    if advisory is None:
        print("[pipeline] generate_advisory returned None")
    return advisory


async def synthesize(advisory: AgriAdvisory, phone: str) -> str | None:
    """gTTS the advisory into an mp3 for a WhatsApp voice reply; path or None."""
    out_path = os.path.join(tempfile.gettempdir(), f"advisory_{phone}.mp3")
    try:
        return await asyncio.to_thread(synthesize_advisory, advisory, out_path)
    except Exception as exc:
        print(f"[pipeline] tts failed: {exc}")
        return None


async def speak(text: str, lang: str, phone: str) -> str | None:
    """gTTS arbitrary text (greetings / prompts) into an mp3; path or None.

    `lang` is our short code ("ur"/"en"), which gTTS accepts directly.
    """
    from gtts import gTTS

    out_path = os.path.join(tempfile.gettempdir(), f"say_{phone}.mp3")

    def _work() -> str:
        gTTS(text=text, lang=lang).save(out_path)
        return out_path

    try:
        return await asyncio.to_thread(_work)
    except Exception as exc:
        print(f"[pipeline] speak (tts) failed: {exc}")
        return None
