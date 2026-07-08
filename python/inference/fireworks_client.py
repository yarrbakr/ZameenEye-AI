"""
Day 5-6: Real Fireworks AI calls using Llama-3-70B, consuming Kai's exact JSON.
"""
import os, json, re
from fireworks.client import Fireworks
from pydantic import ValidationError
from prompts.schemas import HazardPayload, AgriAdvisory, LANGUAGE_CODE_MAP
from prompts.personas_templates import build_localized_prompt

client = Fireworks(api_key=os.environ["FIREWORKS_API_KEY"])

MODEL = "accounts/fireworks/models/llama-v3p3-70b-instruct"
TEMPERATURE = 0.3
MAX_TOKENS = 1024

BANNED_PATTERNS = [r"\bpanic\b", r"\bdie\b", r"\bcertain death\b"]
AGRI_KEYWORDS = {
    "ur": ["فصل", "مویشی"],
    "hi": ["फसल", "पशु"],
    "sw": ["mazao", "mifugo"],
    "ta": ["பயிர்", "கால்நடை"],
}


def call_fireworks(prompt: str) -> str:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=TEMPERATURE,
        max_tokens=MAX_TOKENS,
    )
    return response.choices[0].message.content


def guardrail_check(advisory: AgriAdvisory) -> list[str]:
    problems = []
    text = advisory.advisory_text

    for pattern in BANNED_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            problems.append(f"Banned/alarmist phrase matched: {pattern}")

    keywords = AGRI_KEYWORDS.get(advisory.language, [])
    if keywords and advisory.hazard_type != "none" and not any(kw in text for kw in keywords):
        problems.append("No agricultural-domain keyword found — possible mistranslation.")

    if len(text.strip()) < 10:
        problems.append("Advisory text suspiciously short.")

    return problems


def generate_advisory(raw_payload: dict) -> AgriAdvisory | None:
    try:
        payload = HazardPayload.model_validate(raw_payload)
    except ValidationError as e:
        print(f"[INPUT FAIL] {e}")
        return None

    prompt, lang_code = build_localized_prompt(payload)
    raw = call_fireworks(prompt)

    try:
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        advisory = AgriAdvisory.model_validate_json(cleaned)
    except ValidationError as e:
        print(f"[SCHEMA FAIL] {lang_code}: {e}")
        return None

    problems = guardrail_check(advisory)
    if problems:
        print(f"[GUARDRAIL FAIL] {lang_code}: {problems}")
        return None

    print(f"[OK] {lang_code}: {advisory.advisory_text}")
    return advisory


if __name__ == "__main__":
    sample_payload = {
        "land": {"id": "1", "label": "Multan Field A", "country": "Pakistan"},
        "owner": {"name": "Ali", "phone_number": "+92xxx", "role": "farmer",
                   "preferred_language": "urdu"},
        "has_active_hazard": True,
        "intersecting_events": [
            {"source": "nasa_firms", "detected_at": "2026-07-04T10:00:00Z",
             "raw_payload": {"confidence": 85, "intensity": 340,
                              "detected_at": "2026-07-04T10:00:00Z"}}
        ],
    }
    generate_advisory(sample_payload)