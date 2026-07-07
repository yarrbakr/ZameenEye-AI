# progress.md — ZameenEye AI · Abu Bakr's Working Bible

> Source of truth for my (Voice / ASR / DevOps) tasks and overall project state.
> **Keep this current** — check items off as they land, add TODOs as they appear.
> Referenced by [`CLAUDE.md`](CLAUDE.md) so it loads every session.

**Last updated:** 2026-07-07 (Day 5)
**Sprint clock:** Day 1 = Jul 3 · Day 2 = Jul 4 · Day 3 = Jul 5 · Day 4 = Jul 6 · **Day 5 = Jul 7 (TODAY, ⚡ Fireworks credits drop)** · Day 6 = Jul 8 (pitch)

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[>]` deferred/future · `[→]` reassigned

---

## Git workflow (READ BEFORE MERGING)

- **Remote:** `origin` → https://github.com/yarrbakr/ZameenEye-AI.git
- **Working branch:** `feature/voice-asr` — all of my (voice/ASR/webhook/DevOps) work happens here.
- **`main` is off-limits for direct commits.** Never commit or push straight to `main`.
- **Merge rule:** Open a PR from `feature/voice-asr` → `main` and merge it **ONLY AFTER
  every one of my tasks in §1 (Day 1–6) is checked `[x]`.** Do not merge partial work.
- Push the branch to `origin` when ready to share / open the PR (`git push -u origin feature/voice-asr`).
  **Nothing has been pushed yet — all work is local until I say so.**
- Before opening the PR: rebase/merge latest `main` in, resolve conflicts, confirm the full
  loop (§5) works end-to-end.

---

## 0. Where we stand right now (honest snapshot)

- ✅ Backend skeleton, DB, spatial logic, FIRMS ingest — **Kai, solid.**
- ✅ AI pipeline (prompts, Fireworks client, gTTS, sandbox tests 4 langs) — **Sabrith.** Import bug now fixed (§6).
- ✅ **My voice service — SCAFFOLDED & smoke-tested in `python/voice/`** (Day 4). Reused ~80% from my
  working WhatsApp bot (AXION General-Bot). Webhook + media + send + ASR + glue all written, all 7 files
  byte-compile, and the offline webhook smoke test passes (verify handshake, fast 200 ACK, background dispatch).
- **[→] CV segmentation on AMD → reassigned to Kai.** I'm blocked on AMD cloud registration; my lane is the
  AMD-free voice loop. The team still meets the AMD judging criterion via Kai's CV work.
  **Goodwill contribution (Day 5):** wrote + validated the CV **inference script** (`python/cv/`, SAM/FastSAM/YOLOv8-seg,
  device-agnostic) for Kai to deploy on AMD — proven on a real Multan satellite tile (36 segments, CPU, 1.25s).
- ✅ **Live backend integration VERIFIED (Day 5):** ran Kai's server locally against the **shared Supabase** →
  `resolver.py` DB fallback resolved phone→landId, live `POST /spatial-check` returned real hazard JSON
  (2 fire events), the `to_hazard_payload` bridge validated against `HazardPayload`, and gTTS produced an mp3 —
  the full chain **minus Fireworks** (which is stubbed pending the Day-5 key).
- ⚠️ Remaining before the loop is LIVE: real Fireworks key (Day-5 credits, today), send a real audio reply over WhatsApp, deploy.

---

## 1. My tasks by sprint day

### Day 1–2 — Meta setup & webhook skeleton
- [x] Meta Developer account + Business App (already had it from prior WhatsApp bot work)
- [x] Enable **WhatsApp Cloud API** product
- [ ] Whitelist Authorized Testers: whole team **+ uncle's number** (still need to add uncle)
- [x] Note Phone Number ID, WABA ID, token, App Secret (in root `.env`)
- [x] **`POST /webhook`** — receives Meta payloads, fast 200 ACK, async background (`python/voice/main.py`)
- [x] **`GET /webhook`** verify handshake — owned by the voice service now, not Kai (`python/voice/main.py`)

### Day 3–4 — Media download + local ASR (← focus area, TODAY)
- [x] **Media download** — 2-step Graph fetch (`python/voice/whatsapp.py::download_media`)
- [x] **faster-whisper ASR** — VERIFIED: transcribes to Urdu script, not Hindi (`base` tested; set
      `WHISPER_MODEL=small`/`medium` for accuracy — `base` misheard آگ as آپ). Test: `python/voice/tests/test_asr_urdu.py`
- [x] **Prove the ingress half** (voice → text) — webhook smoke test + real faster-whisper both pass

### Day 5 — Compute activation (Jul 7)
- [→] ~~Deploy CV segmentation (SAM / YOLOv8) on the AMD GPU cloud~~ — **reassigned to Kai** (I'm blocked on AMD registration)
  - [x] Wrote the **inference script** for Kai to deploy: `python/cv/segment.py` (SAM / FastSAM / YOLOv8-seg,
        auto-detects AMD-ROCm / NVIDIA / CPU via torch). Validated locally on a real Multan satellite tile
        (FastSAM-s, CPU, 36 segments, 1.25s → `overlay.png` + `segments.json`). Deploy steps: `python/cv/README.md`.
- [x] Wire the **full loop** — glue (`python/voice/pipeline.py`) VERIFIED live end-to-end (only Fireworks stubbed, pending the Day-5 key)
- [~] Send transcribed text/coords into `/spatial-check`; pipe result to Fireworks + gTTS — `/spatial-check`+gTTS live-verified; Fireworks awaits the key
- [x] Send the resulting `.mp3` back over WhatsApp — `python/voice/whatsapp.py::send_audio` (upload-by-id)

### Day 6 — Ground truth + pitch (Jul 8, whole team)
- [ ] Deploy voice service to **Render (CPU free tier)**; backend on Render + Supabase
- [ ] Ground-truth loop: uncle sends **real Urdu voice notes** about his managed lands
- [ ] Review Fireworks output tone with the team; tune prompts on his feedback
- [ ] Freeze branches; help compile the pitch deck (emphasize the voice loop + AMD via Kai's CV)

---

## 2. Immediate next actions (do these first)

1. [x] `pip install -r python/requirements.txt` into `.venv` (+ `hf_xet` for HF model downloads).
2. [x] Test **real Urdu ASR** — passes, returns Urdu script (`python/voice/tests/test_asr_urdu.py`).
3. [~] `PHONE_LAND_MAP` now optional — `resolver.py`'s read-only DB fallback is VERIFIED live (phone→landId off the shared DB).
       Still add uncle's real number→landId here for the demo. Seed `ur_active` landId = `f0253a35-c867-4362-8361-2478ce927a25`.
4. [x] Offline pipeline test — passes, produces an mp3 (`python/voice/tests/test_pipeline_offline.py`).
5. [ ] Full local loop: `npm run dev` (:3000) + `uvicorn voice.main:app --port 8000` (from `python/`) +
       `ngrok http 8000` → register the ngrok URL + verify token in Meta → send a voice note.

## 3. My webhook (design notes)

- **Standalone Python service** (`python/voice/`, FastAPI) — owns **both** `GET`/`POST /webhook` and calls
  Kai's `POST /spatial-check` over HTTP (`SPATIAL_CHECK_URL`). **Not** a router in Kai's `app.ts`.
- Meta sends `entry[].changes[].value.messages[]`; a voice note is `messages[0].type=="audio"`, id at `messages[0].audio.id`.
- Returns **200 immediately** (Meta retries on non-200); the heavy work runs in a `BackgroundTasks` task.
- Sender phone → `resolve_land_id()` (`resolver.py`): `PHONE_LAND_MAP` config (demo) → read-only DB query
  (schema confirmed: singular `"land"`/`"user"`, `"ownerId"` FK).
- Shape bridge in `pipeline.to_hazard_payload`: null `preferred_language` → `urdu`; inject `detected_at` when the event lacks it.

## 4. DevOps / deployment checklist
- [x] `.env.example` documenting all keys (project root)
- [x] `python/requirements.txt` pinned (fastapi, uvicorn, httpx, faster-whisper, fireworks-ai, gtts, psycopg, …)
- [x] `documents/` git-ignored (planning PDF may hold uncle's number)
- [ ] Render service for the voice service (CPU) + the TS server; ensure Session Pooler DB URL
- [ ] Public HTTPS webhook URL (ngrok in dev / Render in prod) registered in the Meta dashboard
- [→] AMD GPU env for CV models — **Kai**
- [ ] Rotate any secret that ever lands in a commit/chat (esp. Supabase password)

## 5. Full-loop integration (the money shot)
- [x] voice → text (mine) — faster-whisper returns Urdu, verified
- [x] number → landId → `/spatial-check` (mine calls Kai) — VERIFIED live vs shared Supabase (landId `f0253a35…`, 2 fire events, bridge handles nested `detected_at`)
- [~] hazard JSON → Fireworks (`generate_advisory`) — import fixed; needs the Day-5 key
- [x] advisory → gTTS (`synthesize_advisory`) — working (Sabrith)
- [x] mp3 → WhatsApp reply (mine, `send_audio`) — code done
- [ ] End-to-end demo recording captured (for the pitch, before anything breaks)

## 6. Known bugs / risks
- [x] ~~`fireworks_client.py` broken imports~~ — **FIXED** → `prompts.schema`, `prompts.persona_templates`.
- [x] ~~No `requirements.txt` / `.env.example`~~ — **ADDED** (`python/requirements.txt`, root `.env.example`).
- [x] ~~`documents/` untracked / public-push risk~~ — **git-ignored.**
- [~] `fireworks_client.py` builds its Fireworks client at **import time** (`os.environ["FIREWORKS_API_KEY"]`).
      The voice service works around it (`main.py` loads `.env` before importing the pipeline; smoke-tested), but a
      real/empty key must exist to boot. _Nice-to-have:_ ask Sabrith to lazy-init the client.
- [ ] Confirm `preferred_language` null-handling end-to-end (we default → `urdu`; confirm with Sabrith).

## 7. Backlog / future
- [>] Higher-quality / offline Urdu TTS (gTTS is fine for the demo)
- [>] UNOSAT flood perimeters + Copernicus Sentinel (only FIRMS wired now)
- [>] Queue/worker for async media processing instead of the inline background task
- [>] Retry/idempotency on the Meta webhook (dedupe repeated deliveries)
- [>] Use the transcript (`text`) for intent / which-land selection (advisory is land-driven for now)
- [>] Transcode mp3 → ogg/opus so the reply renders as a true WhatsApp voice-note bubble
- [>] Move the offline webhook smoke test (scratchpad) into the repo as a real test
- [>] Lazy-init the Fireworks client (see §6)

## 8. Decision log
- 2026-07-06 — Repo copied into `D:\HACKATHONS\AMD-Developer-Hackathon-II` with full git history
  (origin: yarrbakr/ZameenEye-AI, branch `main`). Added CLAUDE.md + progress.md.
- 2026-07-06 — Created working branch `feature/voice-asr` off `main`. All my work on this branch → PR into
  `main` only after ALL §1 tasks are done. No direct commits to `main`.
- 2026-07-06 — **Reuse over rebuild:** my WhatsApp bot (AXION General-Bot) becomes a **standalone Python
  voice service** at `python/voice/` that HTTP-calls Kai's `/spatial-check` and imports Sabrith's Fireworks +
  gTTS in-process. Chosen over porting the webhook to TS in `app.ts` (ASR/TTS are Python anyway; Day 4 of 6).
- 2026-07-06 — **CV-on-AMD reassigned to Kai.** I'm blocked on AMD cloud registration; my lane is the
  AMD-free voice loop end-to-end. Team hits the AMD judging criterion via Kai's CV work.
- 2026-07-06 — ASR = **faster-whisper** (native Urdu, CPU, light deps). Phone→land = **config map now +
  read-only DB query** (schema confirmed).
- 2026-07-06 — Built `python/voice/` via two subagents; all 7 files byte-compile; offline webhook smoke test passes.
- 2026-07-06 — Installed deps into `.venv` (`--system-site-packages`, so existing globals weren't reinstalled)
  + `hf_xet` (the plain HF HTTP download of the whisper model stalled at 0 bytes; hf_xet fixed it instantly).
  Verified: offline pipeline test produces an mp3; real faster-whisper returns Urdu (`base` tested).
  Repo tests live in `python/voice/tests/`.
- 2026-07-07 (Day 5) — Ran Kai's backend locally against the **team's shared Supabase** (already migrated + seeded).
  Verified end-to-end **minus Fireworks**: `resolver.py` DB fallback → live `POST /spatial-check` → `to_hazard_payload`
  bridge → `HazardPayload` validation → gTTS mp3. Confirmed `/spatial-check` nests `detected_at` inside `raw_payload`
  (not top-level) and returns 2 fire events for `ur_active`. Seed `ur_active` landId = `f0253a35-c867-4362-8361-2478ce927a25`.
- 2026-07-07 (Day 5) — **CV goodwill hand-off:** built + validated the satellite-segmentation **inference script**
  (`python/cv/`, ultralytics SAM / FastSAM / YOLOv8-seg) so Kai can deploy it on AMD. Device-agnostic (ROCm/CUDA/CPU
  via `torch.cuda.is_available()`). Proven on a real Esri World-Imagery tile of the Multan demo area: FastSAM-s, CPU,
  36 segments in 1.25s → `overlay.png` + `segments.json`. Separate `python/cv/requirements.txt` keeps torch OUT of the
  CPU voice service. Only install needed was `opencv-python-headless` (torch/ultralytics already present).

## 9. Open questions for the team
- [x] Phone → `landId` — **resolved:** config map (demo) + read-only DB query (`resolver.py`).
- [x] Which ASR — **resolved:** local faster-whisper (CPU; AMD not needed for voice).
- [x] Get a real seed `landId` — **resolved:** `ur_active` = `f0253a35-c867-4362-8361-2478ce927a25` (still need uncle's real phone for the demo map).
- [x] Does the live `/spatial-check` include `detected_at` per event? — **answered:** it's **nested inside `raw_payload`**, not top-level; the bridge pulls it from there (verified on 2 live events).
