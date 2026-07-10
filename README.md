# ZameenEye AI

**A voice-first disaster-advisory layer for Pakistani farmers.** A farmer sends an **Urdu
voice note on WhatsApp** → we transcribe it → check their land coordinates against live
hazard feeds (NASA FIRMS) → a fast **Fireworks AI** LLM writes localized advice → we send
an **audio reply back on WhatsApp**. A **YOLOv8 wildfire-smoke detector trained on AMD
Instinct GPUs (ROCm)** adds satellite/aerial fire detection to the hazard layer.

> Built for the **AMD × Fireworks AI Startup Hackathon**.

---

## End-to-end loop

```
WhatsApp Urdu voice note
  → POST /webhook (FastAPI)  → download audio from Meta → ASR (faster-whisper, Urdu)
  → POST /spatial-check (Express + PostGIS: land polygon × live hazard events)
  → Fireworks LLM  (gpt-oss-120b → localized advisory JSON; Mistral fallback)
  → gTTS (text → mp3)
  → WhatsApp audio reply
```

The **CV lane** trains a YOLOv8 smoke detector on the AMD Instinct GPU; `best.pt` plugs
into `python/cv/cv_inference.py` to turn satellite tiles into fire detections that feed
the same hazard layer.

## Tech stack

| Layer | Tech |
|---|---|
| Voice service | Python, FastAPI, faster-whisper (CTranslate2), gTTS |
| LLM advisory | Fireworks AI (`gpt-oss-120b`), Mistral fallback |
| Backend / spatial | TypeScript, Express, TypeORM, Supabase PostgreSQL + PostGIS |
| Computer vision | Ultralytics YOLOv8, PyTorch + **ROCm** (AMD Instinct GPU) |
| Containerization | Docker + Docker Compose |

---

## Quick start (containerized)

**Prerequisites:** Docker + Docker Compose, and a `.env` file (see below). Supabase
Postgres is external (cloud), so there is no DB container.

```bash
cp .env.example .env        # then fill in the values (see "Configuration")
docker compose up --build
```

This starts two services:
- **backend** on `http://localhost:3000` (Express + PostGIS `/spatial-check`)
- **voice** on `http://localhost:8000` (FastAPI WhatsApp webhook + ASR + advisory + TTS)

### Verify it's running (no WhatsApp/secrets needed)

```bash
# Voice service health + Meta webhook verification handshake:
curl http://localhost:8000/
curl "http://localhost:8000/webhook?hub.mode=subscribe&hub.verify_token=$WHATSAPP_VERIFY_TOKEN&hub.challenge=42"
# → echoes 42 when the token matches
```

### Exercise the live WhatsApp loop

WhatsApp needs a **public HTTPS URL** in front of the voice service:

```bash
ngrok http 8000
```
Then in the **Meta WhatsApp Cloud API** dashboard → Configuration → Webhook:
- **Callback URL:** `https://<your-ngrok>.ngrok-free.app/webhook`
- **Verify token:** your `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the **`messages`** field.

Send an Urdu voice note from a whitelisted tester number (mapped in `PHONE_LAND_MAP`) →
you get an audio advisory reply.

---

## Configuration (`.env`)

Copy `.env.example` and fill in:

| Key | What |
|---|---|
| `DATABASE_URL` | Supabase **Session Pooler** connection string |
| `FIREWORKS_API_KEY` | Fireworks AI key (advisory LLM) |
| `FIREWORKS_MODEL` | optional; defaults to `accounts/fireworks/models/gpt-oss-120b` |
| `MISTRAL_API_KEY` / `MISTRAL_MODEL` | fallback LLM |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_VERIFY_TOKEN` | Meta WhatsApp Cloud API |
| `SPATIAL_CHECK_URL` | backend URL; compose sets it to `http://backend:3000/spatial-check` |
| `PHONE_LAND_MAP` | JSON map of tester phone → landId (demo) |
| `WHISPER_MODEL` | `base` (fast) or `small` (more accurate Urdu) |

---

## Running without Docker (dev)

**Backend** (`:3000`):
```bash
npm install && npm run dev
```

**Voice service** (`:8000`) — from `python/`:
```bash
pip install -r requirements.txt
uvicorn voice.main:app --port 8000
```

**Tests** (from `python/`):
```bash
../.venv/Scripts/python.exe voice/tests/test_pipeline_offline.py   # bridge + gTTS (no keys)
../.venv/Scripts/python.exe voice/tests/test_fireworks_live.py     # one real Fireworks call
```

---

## CV: train the wildfire model on AMD

The Roboflow wildfire dataset (513/146/74 images, YOLOv8 format) ships in the repo at
`python/cv/Wildfire-1`. On an AMD Instinct (ROCm) box:

```bash
cd python
pip install ultralytics opencv-python-headless
python -c "import torch; print(torch.cuda.is_available())"   # must be True on the GPU box
python run_yolo.py                                           # 50 epochs; auto-detects the GPU
```
Weights land at `runs/detect/wildfire_amd/weights/best.pt`, then:
```bash
python cv/cv_inference.py --weights runs/detect/wildfire_amd/weights/best.pt --dir cv/Wildfire-1/test/images
```

---

## Repo layout

```
Dockerfile.backend  Dockerfile.voice  docker-compose.yml   # containerization
src/                TypeScript backend (Express + TypeORM + PostGIS)
python/
  voice/            FastAPI webhook + ASR + pipeline glue   (voice service)
  inference/        Fireworks advisory client
  prompts/  tts/    advisory schema/persona + gTTS
  cv/               YOLOv8 dataset (Wildfire-1) + inference (cv_inference.py)
  run_yolo.py       YOLOv8 training entrypoint (portable, GPU auto-detect)
```
