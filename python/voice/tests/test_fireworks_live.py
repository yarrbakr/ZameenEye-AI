"""Live Fireworks check — makes ONE real generate_advisory call to confirm the
FIREWORKS_API_KEY + model actually work end to end (transcript-aware). Costs a
fraction of a cent. The /spatial-check part is a canned hazard payload, so this
isolates the LLM step.

Run from python/ with the venv:
    ..\\.venv\\Scripts\\python.exe voice\\tests\\test_fireworks_live.py
"""
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")   # Urdu prints crash on cp1252 otherwise
except Exception:
    pass

from dotenv import load_dotenv
load_dotenv()                                  # walks up to the repo-root .env

PYROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, PYROOT)

import voice.pipeline as pl
from inference.fireworks_client import generate_advisory

MOCK_SPATIAL = {
    "checked_at": "2026-07-06T12:00:00Z",
    "land": {"id": "land-uuid-123", "label": "North field", "country": "Pakistan"},
    "owner": {"name": "Uncle", "phone_number": "923001234567", "role": "farmer",
              "preferred_language": "urdu"},
    "has_active_hazard": True,
    "intersecting_events": [
        {"source": "nasa_firms",
         "raw_payload": {"confidence": 85, "intensity": 340,
                         "detected_at": "2026-07-04T10:00:00Z"}},
    ],
}

payload = pl.to_hazard_payload(MOCK_SPATIAL)
question = "میری فصل کو آگ کا خطرہ ہے"        # "my crop is at risk of fire"

model = os.getenv("FIREWORKS_MODEL", "accounts/fireworks/models/gpt-oss-120b (default)")
print("Provider :", os.getenv("LLM_PROVIDER", "fireworks"))
print("Model    :", model)
print("Key set  :", bool(os.getenv("FIREWORKS_API_KEY")))
print("Calling Fireworks (one real request)...")

advisory = generate_advisory(payload, question)
print("=== ADVISORY ===")
print(advisory)
print("RESULT:", "PASS - Fireworks key + model work" if advisory else "FAIL - returned None")
