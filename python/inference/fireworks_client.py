"""
Real LLM calls (Fireworks primary, Mistral fallback), consuming Kai's exact JSON.

Both providers expose the same OpenAI-compatible chat API, so one helper
(_chat_json) drives both — only URL/key/model differ. We always request JSON
mode: every model Fireworks now serves is a *reasoning* model that otherwise
prefixes its answer with chain-of-thought, which breaks JSON parsing.

No SDK, no client object: the key is read at call time, so importing this module
never requires FIREWORKS_API_KEY (keeps the voice webhook importable).
"""
import os, json, re

import httpx
from pydantic import ValidationError
from prompts.schema import HazardPayload, AgriAdvisory, LANGUAGE_CODE_MAP
from prompts.persona_templates import build_localized_prompt

# Swap the model without a code change via FIREWORKS_MODEL in .env. Default is
# gpt-oss-120b: cheap, good Urdu, parses cleanly in JSON mode. deepseek-v4-pro
# gives nicer Urdu at higher cost; glm-5p2 also works. (Llama was retired from
# Fireworks serverless — the old hardcoded id now 404s.)
MODEL = os.getenv("FIREWORKS_MODEL", "accounts/fireworks/models/gpt-oss-120b")
TEMPERATURE = 0.3
# Headroom for reasoning models: their internal reasoning counts toward the output
# budget, so a tight cap (e.g. 300) can truncate the response before the JSON lands.
MAX_TOKENS = 1024

BANNED_PATTERNS = [r"\bpanic\b", r"\bdie\b", r"\bcertain death\b"]
# Domain-anchor keywords: at least one must appear, else we suspect a
# mistranslation. Kept broad (field/land/farmer/animal, not just crop/livestock)
# so natural advice like "آپ کے کھیت کے قریب آگ" isn't wrongly rejected.
AGRI_KEYWORDS = {
    "ur": ["فصل", "مویشی", "کھیت", "کھیتی", "زمین", "کسان", "جانور", "باڑی"],
    "hi": ["फसल", "पशु", "खेत", "खेती", "ज़मीन", "जमीन", "किसान", "मवेशी"],
    "sw": ["mazao", "mifugo", "shamba", "mkulima", "ardhi", "wanyama"],
    "ta": ["பயிர்", "கால்நடை", "வயல்", "நிலம்", "விவசாய", "மாடு"],
}


def _chat_json(url: str, api_key: str, model: str, prompt: str) -> str:
    """One chat-completion in JSON mode against any OpenAI-compatible endpoint.

    Fireworks and Mistral share this exact request/response shape, so both reuse
    this — only URL/key/model differ. response_format=json_object forces reasoning
    models to return just the JSON object (no chain-of-thought), which the caller
    parses. Raises on HTTP error or empty content.
    """
    resp = httpx.post(
        url,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": TEMPERATURE,
            "max_tokens": MAX_TOKENS,
            "response_format": {"type": "json_object"},
        },
        timeout=90,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"].get("content")
    if not content:
        raise ValueError(f"empty content from {model} (reasoning-only response)")
    return content


def call_fireworks(prompt: str) -> str:
    """Primary path. Model is set by FIREWORKS_MODEL (default gpt-oss-120b)."""
    return _chat_json(
        "https://api.fireworks.ai/inference/v1/chat/completions",
        os.environ["FIREWORKS_API_KEY"], MODEL, prompt,
    )


def call_mistral(prompt: str) -> str:
    """Fallback via Mistral La Plateforme (LLM_PROVIDER=mistral + MISTRAL_API_KEY)."""
    return _chat_json(
        "https://api.mistral.ai/v1/chat/completions",
        os.environ["MISTRAL_API_KEY"],
        os.getenv("MISTRAL_MODEL", "mistral-small-latest"), prompt,
    )


def call_llm(prompt: str) -> str:
    """Route to the configured LLM provider. Default: Fireworks (Sabrith's path).

    Set LLM_PROVIDER=mistral to swap in Mistral for local testing before the
    Fireworks key lands; unset it (or =fireworks) to go back with no code change.
    """
    if os.getenv("LLM_PROVIDER", "fireworks").lower() == "mistral":
        return call_mistral(prompt)
    return call_fireworks(prompt)


def guardrail_check(advisory: AgriAdvisory) -> list[str]:
    """Return HARD failures that must reject the advisory (alarmist phrases,
    suspiciously short text). The farming-keyword check is now a SOFT signal —
    logged as a warning, not a rejection: advisories are transcript-driven, so a
    good answer to an off-topic-but-grounded question (e.g. "how's the weather?")
    may legitimately omit farming vocabulary. Rejecting it would silently drop a
    correct reply to the generic error fallback.
    """
    problems = []
    text = advisory.advisory_text

    for pattern in BANNED_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            problems.append(f"Banned/alarmist phrase matched: {pattern}")

    if len(text.strip()) < 10:
        problems.append("Advisory text suspiciously short.")

    # Soft check (warn only): with an active hazard we EXPECT farming vocab, but a
    # transcript-driven reply may reasonably not contain it. Log, do not reject.
    keywords = AGRI_KEYWORDS.get(advisory.language, [])
    if keywords and advisory.hazard_type != "none" and not any(kw in text for kw in keywords):
        print(f"[GUARDRAIL WARN] {advisory.language}: no farming keyword in advisory "
              f"(likely a transcript-driven, off-topic-but-grounded answer).")

    return problems


def _extract_json_object(raw: str) -> dict:
    """Pull the first JSON object out of an LLM response, tolerating code fences,
    leading chain-of-thought, and trailing prose after the object — reasoning
    models sometimes wrap or append text even in JSON mode. raw_decode parses the
    first complete object and ignores anything after it.
    """
    text = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    start = text.find("{")
    if start == -1:
        raise ValueError(f"no JSON object found in response: {text[:120]!r}")
    obj, _end = json.JSONDecoder().raw_decode(text[start:])
    return obj


def generate_advisory(raw_payload: dict, transcript: str = "") -> AgriAdvisory | None:
    try:
        payload = HazardPayload.model_validate(raw_payload)
    except ValidationError as e:
        print(f"[INPUT FAIL] {e}")
        return None

    # transcript = the farmer's transcribed voice note (optional). When present,
    # the prompt asks the LLM to answer THAT question using the hazard data as
    # context; when blank, the prompt is byte-identical to the old status-report.
    prompt, lang_code = build_localized_prompt(payload, transcript)
    raw = call_llm(prompt)

    try:
        advisory = AgriAdvisory.model_validate(_extract_json_object(raw))
    except (ValidationError, ValueError) as e:
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