"""Offline full-loop test for the voice pipeline. No API keys / servers needed.

Run (from the repo root):
    .venv\\Scripts\\python.exe python\\voice\\tests\\test_pipeline_offline.py

Everything is REAL except the two live externals — Kai's /spatial-check (HTTP)
and the Day-5 Fireworks call — which are stubbed. Proves the shape-bridge, the
pydantic HazardPayload validation, and the real gTTS step all wire together into
a playable .mp3.
"""
import sys, os, asyncio, types

try:
    sys.stdout.reconfigure(encoding="utf-8")   # Urdu prints crash on the cp1252 Windows console otherwise
except Exception:
    pass

PYROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, PYROOT)
os.environ.setdefault("FIREWORKS_API_KEY", "dummy-offline")  # client is built at import time

import voice.pipeline as pl
from prompts.schema import HazardPayload, AgriAdvisory

MOCK_SPATIAL = {
    "checked_at": "2026-07-06T12:00:00Z",
    "land": {"id": "land-uuid-123", "label": "North field", "country": "Pakistan"},
    "owner": {"name": "Uncle", "phone_number": "923001234567", "role": "farmer",
              "preferred_language": None},          # null -> transform must default to urdu
    "has_active_hazard": True,
    "intersecting_events": [
        {"source": "nasa_firms",
         "raw_payload": {"confidence": 85, "intensity": 340,
                         "detected_at": "2026-07-04T10:00:00Z"}}   # no top-level detected_at
    ],
}

print("[1] to_hazard_payload bridges the shape + validates against pydantic HazardPayload ...")
payload = pl.to_hazard_payload(MOCK_SPATIAL)
hp = HazardPayload(**payload)  # raises if the bridged shape is wrong
assert hp.owner.preferred_language == "urdu", hp.owner.preferred_language
assert hp.intersecting_events[0].detected_at == "2026-07-04T10:00:00Z", hp.intersecting_events[0].detected_at
print("    preferred_language:", hp.owner.preferred_language, "(null -> urdu OK)")
print("    event detected_at :", hp.intersecting_events[0].detected_at, "(pulled from raw_payload OK)")

canned = AgriAdvisory(
    language="ur", location_name="North field", hazard_type="fire", risk_level="high",
    advisory_text="آپ کی زمین کے قریب آگ لگی ہے۔ اپنے مویشیوں کو محفوظ مقام پر لے جائیں اور مقامی حکام سے رابطہ کریں۔",
    recommended_action="Move livestock to safe ground", confidence="high",
    source_timestamp_utc="2026-07-04T10:00:00Z",
)

class _Resp:
    def raise_for_status(self):
        pass
    def json(self):
        return MOCK_SPATIAL

class _Client:
    def __init__(self, *a, **k):
        pass
    async def __aenter__(self):
        return self
    async def __aexit__(self, *a):
        return False
    async def post(self, url, json=None):
        return _Resp()

pl.resolve_land_id = lambda phone: "land-uuid-123"       # stub the seed-landId lookup
pl.httpx = types.SimpleNamespace(AsyncClient=_Client)     # stub Kai's live /spatial-check
pl.generate_advisory = lambda payload: canned            # stub the Day-5 Fireworks call

print("[2] running the real pipeline.run() with those three stubbed ...")
mp3 = asyncio.run(pl.run("923001234567", "میری فصل کو آگ کا خطرہ ہے"))
ok = bool(mp3) and os.path.exists(mp3) and os.path.getsize(mp3) > 0
print("=== PIPELINE RESULT ===")
print("mp3 path :", mp3)
print("size     :", (os.path.getsize(mp3) if (mp3 and os.path.exists(mp3)) else 0), "bytes")
print("RESULT:", "PASS - produced an audio advisory end-to-end" if ok else "FAIL")
