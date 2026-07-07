"""
System personas + few-shot examples + localization logic.
Consumes Kai's exact JSON shape (HazardPayload from schemas.py).
"""
from prompts.schema import HazardPayload, LANGUAGE_CODE_MAP

BASELINE_SYSTEM_PROMPT = """You are AgriGuard, an agricultural safety advisor.
You receive structured hazard data about a farmer's land and must produce
SHORT, CALM, ACTIONABLE spoken-style advice.

Rules:
- Never cause panic; state facts, then one clear action.
- Keep it under 4 sentences — this will be converted to audio.
- If confidence is low, say so plainly.
- End with one practical next step.
- If role is "agency_admin", you may use slightly more technical language
  (mention confidence %, event counts). If role is "farmer", keep it simple.
"""

LOCALE_INSTRUCTIONS = {
    "ur": "Respond only in Urdu (اردو), using simple rural vocabulary a farmer would understand.",
    "hi": "Respond only in Hindi (हिन्दी), using simple rural vocabulary a farmer would understand.",
    "sw": "Respond only in Swahili (Kiswahili), using simple rural vocabulary a farmer would understand.",
    "ta": "Respond only in Tamil (தமிழ்), using simple rural vocabulary a farmer would understand.",
    "en": "Respond only in English, using simple rural vocabulary a farmer would understand.",
}

FEW_SHOT_EXAMPLES = [
    {
        "input": {"hazard": True, "location": "Multan, Punjab", "distance_context": "nearby",
                   "intensity": 340, "confidence": 85, "role": "farmer"},
        "output": ("A fire has been detected near your field, with high confidence. "
                    "It is not an immediate threat today. Keep watching wind direction "
                    "and have your irrigation system ready as a precaution."),
    },
    {
        "input": {"hazard": False, "location": "Sindh region", "distance_context": "minor activity nearby",
                   "intensity": 50, "confidence": 40, "role": "farmer"},
        "output": ("There is no significant risk to your field right now. Minor thermal "
                    "activity was detected nearby but does not require any action. "
                    "We will keep monitoring and notify you if that changes."),
    },
]


def _build_examples_text() -> str:
    return "\n\n".join(
        f"Example input: {ex['input']}\nExample output: {ex['output']}"
        for ex in FEW_SHOT_EXAMPLES
    )


def build_localized_prompt(payload: HazardPayload) -> tuple[str, str]:
    """
    Takes Kai's validated payload, returns (prompt_text, language_code).
    """
    lang_code = LANGUAGE_CODE_MAP[payload.owner.preferred_language]

    # Pick the strongest event if any exist (highest confidence)
    top_event = None
    if payload.intersecting_events:
        top_event = max(
            payload.intersecting_events,
            key=lambda e: e.raw_payload.get("confidence", 0),
        )

    hazard_summary = {
        "hazard": payload.has_active_hazard,
        "location": f"{payload.land.label}, {payload.land.country}",
        "role": payload.owner.role,
        "confidence": top_event.raw_payload.get("confidence") if top_event else None,
        "intensity": top_event.raw_payload.get("intensity") if top_event else None,
        "event_count": len(payload.intersecting_events),
    }

    prompt = (
        f"{BASELINE_SYSTEM_PROMPT}\n\n"
        f"--- Examples ---\n{_build_examples_text()}\n\n"
        f"--- Now generate advice for this data ---\n{hazard_summary}\n\n"
        f"{LOCALE_INSTRUCTIONS[lang_code]}\n"
        f"Return ONLY valid JSON matching this schema: language, location_name, "
        f"hazard_type, risk_level, advisory_text, recommended_action, confidence, "
        f"source_timestamp_utc."
    )
    return prompt, lang_code