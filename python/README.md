## Running things

**Always run from inside `python/` using the `-m` flag**, since files import
from sibling folders:

```bash
python -m testing.sandbox_test       # test full pipeline with mock data
python -m tts.text_to_speech          # generate sample audio in all languages
python -m ingestion.firms_fetch       # start live FIRMS data sync
python -m inference.fireworks_client  # real Fireworks call (uses API credits)
```

## Input contract
See `prompts/schema.py` → `HazardPayload`. This must match the backend's
spatial-check output exactly. Any changes to this shape need to be
communicated between backend and GenAI layers before merging.

## Output contract
See `prompts/schema.py` → `AgriAdvisory`. This is what gets passed into
`tts/text_to_speech.py` to generate the final audio file.

## Supported languages
Urdu (`ur`), Hindi (`hi`), Swahili (`sw`), Tamil (`ta`), English (`en`)

## Supported hazard types
`fire`, `flood`, `storm`, `disease`, `other`, `none`

## Docker
```bash
docker build -t zameeneye-genai .
docker run --env-file .env zameeneye-genai
```