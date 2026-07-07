# CLAUDE.md — ZameenEye AI

> **⚠️ START HERE EVERY SESSION:** Read [`progress.md`](progress.md) first. It is the
> single source of truth for what is done, what is next, and what is blocked.
> Update it as work lands — treat it as the project bible, not a scratch note.
> For backend setup, DB, and the `/spatial-check` contract, read [`SETUP.md`](SETUP.md).
>
> **Git:** work on branch **`feature/voice-asr`**. Never commit to `main`. PR into `main`
> only after ALL of my tasks are done — see the "Git workflow" section in `progress.md`.

---

## What this project is

**ZameenEye AI** — a voice-first layer over satellite & disaster data, built for the
**AMD GPUs & Fireworks AI Startup Hackathon** (6-day sprint, target market: Pakistan
AgTech / climate resilience / disaster management).

A farmer sends an **Urdu voice note on WhatsApp** → we transcribe it → check their land
coordinates against live hazard feeds (NASA FIRMS, UNOSAT, Copernicus) → a fast
Fireworks LLM writes localized advice → text-to-speech sends an **audio reply back on
WhatsApp**. Multi-tenant B2B2C SaaS. Deploy target: Supabase + Render. CV segmentation
models (SAM / YOLOv8) run on the **AMD GPU cloud** (a scored judging criterion).

### End-to-end loop
```
WhatsApp voice note
  → [MY LAYER] POST /webhook  → download audio from Meta (graph.facebook.com) → ASR (speech→text)
  → Kai's POST /spatial-check (land polygon × hazard events)
  → Fireworks LLM (localized advisory JSON)
  → gTTS (text→mp3)
  → WhatsApp audio reply
```

## My role — Abu Bakr (Member 3): DevOps, Voice Interface & ASR

I own the **voice ingress/egress path and all Meta/WhatsApp plumbing**:
Meta Developer portal + WhatsApp Cloud API sandbox, tester phone whitelisting,
`POST /webhook`, media-file download from Meta, local speech-to-text (ASR), the
full-loop wiring, and deployment/DevOps. See `progress.md` for the live task list.

> The webhook is a **standalone Python service** (`python/voice/`, FastAPI) — NOT a router in
> Kai's TS server. It owns **both** `GET /webhook` (Meta verify) and `POST /webhook` (incoming
> messages) and calls Kai's `POST /spatial-check` over HTTP. Runs on CPU — **no AMD needed.**

## Team & repo reality

- **Kai / Kainat** — backend lead (TypeScript/Express, TypeORM, Supabase PostGIS, spatial logic). ~10 commits.
- **Sabrith / "Thammnah"** — AI pipeline (prompts, Fireworks client, gTTS). ~2 commits.
- **Me / Abu Bakr** — voice/ASR/DevOps. **In progress** in `python/voice/` (reuses a working
  WhatsApp bot; see `progress.md`). **CV-on-AMD was reassigned to Kai** — I'm blocked on AMD
  cloud registration, so my lane is the (AMD-free) voice loop end-to-end.
- Frontend (Kelvin's dashboard) lives elsewhere — **not in this repo.**

## Repo layout

```
src/                     TypeScript backend (Express + TypeORM)
  app.ts                 Express app (Kai's) — my webhook is a SEPARATE Python service, not mounted here
  server.ts              startup (DB connect → listen)
  config/database.ts     TypeORM DataSource (do NOT add a `migrations` field — see SETUP.md)
  entities/              Tenant, User, Land, DisasterEvent (PostGIS geoms, GIST indexes)
  migrations/ seeds/     hand-written, function-based, numbered 0001, 0002...
  scripts/runner.ts      custom migration/seed runner
  routes/ controllers/ services/   layered pattern — follow it for new endpoints
python/                  AI pipeline + MY voice service (run separately from the TS server)
  ingestion/firms_fetch.py     NASA FIRMS poller → data_lake/
  prompts/                     schema.py (Pydantic) + persona_templates.py
  inference/fireworks_client.py  live Fireworks call (Day 5)
  tts/text_to_speech.py        gTTS text→mp3 (working; sample mp3s committed)
  testing/sandbox_test.py      offline pipeline test (4 languages, passing)
  voice/                       MY voice service (FastAPI, standalone; calls /spatial-check over HTTP)
    main.py                    GET/POST /webhook — Meta verify + inbound, async background processing
    whatsapp.py                Meta Graph API: download media, send_text, send_audio
    asr.py                     faster-whisper speech→text (Urdu, CPU)
    resolver.py                phone → landId (config map now, read-only DB fallback)
    pipeline.py                glue: spatial-check → HazardPayload → Fireworks → gTTS
  requirements.txt             pinned Python deps (pipeline + voice)
  cv/                          CV inference script (SAM/FastSAM/YOLO, device-agnostic) — goodwill hand-off for Kai to deploy on AMD; own requirements.txt
```

## Conventions (match the existing code)

- **New backend endpoint** = logic in `services/` → wire in `controllers/` → path in
  `routes/` → mount router in `app.ts`. Never add a second entrypoint. Mirror the style
  of `spatialCheck.*` / `ingestFirms.*`.
- **`.env` lives in the project root** (same level as `package.json`), never in `src/`.
  Missing `.env` fails silently → all env vars `undefined`.
- **Supabase:** use the **Session Pooler** connection string, not Direct (IPv6) or
  Transaction pooler (6543). See SETUP.md.
- **Migrations** are plain `up`/`down` functions, numbered sequentially. Don't switch to
  TypeORM class migrations.
- Keep entity import casing exact (Linux deploy target is case-sensitive).

## Known gotchas / open bugs (see progress.md "Bugs" for status)

- ✅ **Fixed:** `python/inference/fireworks_client.py` bad imports (now `prompts.schema` /
  `prompts.persona_templates`), and the missing `requirements.txt` / `.env.example`
  (now `python/requirements.txt` + root `.env.example`).
- `fireworks_client.py` builds its Fireworks client at **import time**, so `FIREWORKS_API_KEY`
  must exist (even empty) to boot anything importing it. `voice/main.py` loads `.env` *before*
  importing the pipeline to satisfy this. (Nice-to-have: lazy-init the client.)
- Run the voice service from `python/` (`uvicorn voice.main:app --port 8000`) so its
  `inference.` / `tts.` imports resolve.

## Common commands

```bash
npm install                # deps
npm run dev                # start server on :3000 (connects DB first)
npm run migration:run      # apply migrations
npm run migration:status   # check migration state
npm run seed:run           # seed test data
```
