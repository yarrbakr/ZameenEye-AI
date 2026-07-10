"""
Converts an AgriAdvisory's text into an .mp3 file using gTTS (free, no key).
"""
from gtts import gTTS
from prompts.schema import AgriAdvisory

# gTTS uses its own language codes — map your schema's codes to gTTS's
GTTS_LANG_MAP = {
    "ur": "ur",
    "hi": "hi",
    "sw": "sw",
    "ta": "ta",
    "en": "en",
}


def synthesize_advisory(advisory: AgriAdvisory, output_path: str = "output.mp3") -> str:
    gtts_lang = GTTS_LANG_MAP[advisory.language]
    tts = gTTS(text=advisory.advisory_text, lang=gtts_lang)
    tts.save(output_path)
    print(f"Saved audio -> {output_path}")
    return output_path


if __name__ == "__main__":
    # Standalone test — no dependency on Fireworks or Kai's payload
    test_cases = [
        AgriAdvisory(language="ur", location_name="Multan", hazard_type="fire",
                      risk_level="moderate", advisory_text="آگ کا خطرہ ہے، احتیاط کریں۔",
                      recommended_action="Move livestock", confidence="high",
                      source_timestamp_utc="2026-07-04T10:00:00Z"),
        AgriAdvisory(language="hi", location_name="Sindh", hazard_type="fire",
                      risk_level="high", advisory_text="आग का खतरा है, सावधान रहें।",
                      recommended_action="Move livestock", confidence="high",
                      source_timestamp_utc="2026-07-04T10:00:00Z"),
        AgriAdvisory(language="sw", location_name="Kano", hazard_type="none",
                      risk_level="clear", advisory_text="Hakuna hatari kwa sasa.",
                      recommended_action="None needed", confidence="high",
                      source_timestamp_utc="2026-07-04T10:00:00Z"),
        AgriAdvisory(language="ta", location_name="Tamil Nadu", hazard_type="none",
                      risk_level="clear", advisory_text="தற்போது ஆபத்து இல்லை.",
                      recommended_action="None needed", confidence="high",
                      source_timestamp_utc="2026-07-04T10:00:00Z"),
    ]
    for i, case in enumerate(test_cases):
        synthesize_advisory(case, f"test_{case.language}_{i}.mp3")