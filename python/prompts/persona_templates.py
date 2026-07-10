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
- If the farmer asked a specific question, ANSWER IT DIRECTLY in your first
  sentence. If you don't have the data to answer it (e.g. weather, prices), say
  so briefly, then give the relevant hazard status for their land.
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


def build_localized_prompt(payload: HazardPayload, transcript: str = "") -> tuple[str, str]:
    """
    Takes Kai's validated payload, returns (prompt_text, language_code).

    `transcript` is the farmer's transcribed voice note (optional). When present,
    the prompt asks the LLM to answer THAT specific question using the hazard data
    as context; when blank, the prompt is a plain hazard status report (unchanged).
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

    lang_name = {"ur": "Urdu", "hi": "Hindi", "sw": "Swahili", "ta": "Tamil",
                 "en": "English"}.get(lang_code, lang_code)

    # When the farmer asked something specific, pin the answer to their question
    # (grounded in the hazard data above). Blank transcript -> no block added, so
    # the prompt stays identical to the original status-report behaviour.
    question_block = ""
    if transcript and transcript.strip():
        question_block = (
            f"--- THE FARMER'S QUESTION (transcribed voice note) — answer THIS ---\n"
            f'"{transcript.strip()}"\n'
            f"This is the most important thing to address. Answer their specific "
            f"question directly, using the hazard data provided below as context. "
            f"Stay grounded in their land and its hazards; do not invent facts beyond "
            f"the data. Do not just repeat a generic status report if they asked "
            f"something specific.\n\n"
        )

    prompt = (
        f"{BASELINE_SYSTEM_PROMPT}\n\n"
        f"{question_block}"
        f"--- Style examples (copy the calm tone & length, NOT the wording) ---\n"
        f"{_build_examples_text()}\n\n"
        f"--- Hazard data for this farmer's land ---\n{hazard_summary}\n\n"
        f"{LOCALE_INSTRUCTIONS[lang_code]}\n\n"
        f"Return ONLY a valid JSON object (no markdown, no code fences) with EXACTLY "
        f"these fields. The quoted options below are fixed English tokens — copy them "
        f"verbatim, do NOT translate or reword them:\n"
        f'  "language": "{lang_code}"\n'
        f'  "location_name": <the location as a short string>\n'
        f'  "hazard_type": one of "fire" | "flood" | "storm" | "other" | "none"\n'
        f'  "risk_level": one of "low" | "moderate" | "high" | "critical" | "clear"\n'
        f'  "confidence": one of "low" | "medium" | "high" '
        f"(map any numeric confidence to a bucket; do not output a number)\n"
        f'  "source_timestamp_utc": <ISO-8601 UTC time string>\n'
        f'  "advisory_text": <the advice, written in {lang_name}>\n'
        f'  "recommended_action": <one short next step, written in {lang_name}>\n'
        f"Only advisory_text and recommended_action are written in {lang_name}; every "
        f"other field value must be exactly one of the English tokens listed above."
    )
    return prompt, lang_code