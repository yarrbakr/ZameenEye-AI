"""
Day 3-4: Sandbox test using Kai's exact JSON shape, static/hardcoded.
No live API key needed — uses a mock model response.
Updated to match revised HazardPayload contract (checked_at, no duplicate detected_at).
"""
import json
from datetime import datetime, timezone
from pydantic import ValidationError
from prompts.schema import HazardPayload, AgriAdvisory
from prompts.persona_templates import build_localized_prompt

# --- Static test packets, matching Kai's exact (revised) contract ---
TEST_PACKETS = [
    # Active hazard, farmer, Urdu
    {
        "checked_at": "2026-07-05T14:30:00.000Z",
        "land": {"id": "1", "label": "Multan Field A", "country": "Pakistan"},
        "owner": {"name": "Ali", "phone_number": "+92xxx", "role": "farmer",
                   "preferred_language": "urdu"},
        "has_active_hazard": True,
        "intersecting_events": [
            {"source": "nasa_firms",
             "raw_payload": {"confidence": 85, "intensity": 340,
                              "detected_at": "2026-07-04T10:00:00Z"}}
        ],
    },
    # Active hazard, agency_admin, Hindi
    {
        "checked_at": "2026-07-05T14:35:00.000Z",
        "land": {"id": "2", "label": "Sindh Block 3", "country": "India"},
        "owner": {"name": "Ravi", "phone_number": "+91xxx", "role": "agency_admin",
                   "preferred_language": "hindi"},
        "has_active_hazard": True,
        "intersecting_events": [
            {"source": "nasa_firms",
             "raw_payload": {"confidence": 92, "intensity": 410,
                              "detected_at": "2026-07-04T09:00:00Z"}}
        ],
    },
    # All clear, empty events, Swahili
    {
        "checked_at": "2026-07-05T14:40:00.000Z",
        "land": {"id": "3", "label": "Kano Plot", "country": "Kenya"},
        "owner": {"name": "Amina", "phone_number": "+254xxx", "role": "farmer",
                   "preferred_language": "swahili"},
        "has_active_hazard": False,
        "intersecting_events": [],
    },
    # All clear but with sub-threshold events present, Tamil
    {
        "checked_at": "2026-07-05T14:45:00.000Z",
        "land": {"id": "4", "label": "Tamil Nadu Plot 7", "country": "India"},
        "owner": {"name": "Priya", "phone_number": "+91xxx", "role": "farmer",
                   "preferred_language": "tamil"},
        "has_active_hazard": False,
        "intersecting_events": [
            {"source": "nasa_firms",
             "raw_payload": {"confidence": 40, "intensity": 50,
                              "detected_at": "2026-07-04T08:00:00Z"}}
        ],
    },
]


def mock_llm_call(prompt: str, lang_code: str) -> str:
    """Stand-in for Fireworks — replace with real call once keys are live."""
    sample = {
        "language": lang_code,
        "location_name": "Test Location",
        "hazard_type": "fire",
        "risk_level": "moderate",
        "advisory_text": "Sample advisory text for testing purposes only.",
        "recommended_action": "Move livestock to safety.",
        "confidence": "high",
        "source_timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }
    return json.dumps(sample)


def run_sandbox():
    for i, raw_packet in enumerate(TEST_PACKETS, start=1):
        try:
            payload = HazardPayload.model_validate(raw_packet)
        except ValidationError as e:
            print(f"[INPUT FAIL] packet {i}: {e}")
            continue

        prompt, lang_code = build_localized_prompt(payload)
        raw_response = mock_llm_call(prompt, lang_code)

        try:
            advisory = AgriAdvisory.model_validate_json(raw_response)
            print(f"[PASS] packet {i} ({payload.land.label}, {lang_code}): "
                  f"{advisory.risk_level}")
        except ValidationError as e:
            print(f"[OUTPUT FAIL] packet {i}: {e}")


if __name__ == "__main__":
    run_sandbox()