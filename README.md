# ZameenEye-AI

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![AMD ROCm](https://img.shields.io/badge/AMD_ROCm-005A9C?style=for-the-badge&logo=amd&logoColor=white)

ZameenEye-AI is a hybrid intelligence platform that translates complex orbital science signals into actionable, on-the-ground decision support. It bridges satellite-derived environmental insights with practical execution workflows for communities, agencies, and operators working in high-risk regions.

> Catchphrase: Turning satellite intelligence into grounded action.

## Table of Contents

- [Why ZameenEye-AI Exists](#why-zameeneye-ai-exists)
- [What This Project Does in One Minute](#what-this-project-does-in-one-minute)
- [Architecture Overview](#architecture-overview)
- [Hardware & Infrastructure Optimization (AMD Track 3)](#hardware--infrastructure-optimization-amd-track-3)
- [Repository Structure](#repository-structure)
- [Core Features](#core-features)
- [API Endpoints](#api-endpoints)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Quick Local Test Checklist](#quick-local-test-checklist)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Why ZameenEye-AI Exists

Modern satellite and hazard datasets are rich in signal but difficult to operationalize. ZameenEye-AI closes that gap by combining:

- a Python data engine for ingestion, normalization, and inference workflows
- a TypeScript/Node.js backend for orchestration, API exposure, and persistence
- PostgreSQL-backed storage for spatial and operational data

The result is a production-ready foundation for services such as wildfire/thermal anomaly monitoring, spatial hazard checks, and downstream alerting or automation pipelines.

## What This Project Does in One Minute

In simple terms, ZameenEye-AI takes environmental and satellite-derived signals, processes them through an AI layer, and turns them into usable alerts and backend actions. It is designed for situations where fast, localized, and multilingual communication matters most.

If you are new to the project, think of it as three connected layers:

1. Data intake: collects hazard-related information from sources such as NASA FIRMS.
2. Intelligence layer: normalizes and interprets that data using Python-based processing and LLM inference.
3. Delivery layer: exposes the results through an API and prepares them for alerts, voice delivery, or downstream automation.

## Architecture Overview

ZameenEye-AI follows a layered architecture designed for clarity, extensibility, and reliable operation:

- **Ingestion layer:** Python-based scripts collect and store hazard data from external sources (NASA FIRMS, UNOSAT, Copernicus).
- **Intelligence layer:** normalization, validation, multilingual rendering, and LLM-assisted reasoning transform raw signals into structured output using Fireworks AI.
- **Application layer:** a TypeScript/Node.js backend exposes API endpoints and persists operational data in PostgreSQL through TypeORM.
- **Delivery layer:** the platform prepares data for downstream alerts, voice delivery (multilingual TTS), and future automation workflows.

This design makes it easier to evolve the system without tightly coupling data collection, inference, and user-facing services.

---

## 🛠️ Hardware & Infrastructure Optimization (AMD Track 3)

ZameenEye-AI is explicitly architected to eliminate traditional CPU-bound processing bottlenecks inherent to large-scale geospatial intelligence platforms. The core AI vision pipeline runs natively on **AMD Silicon** leveraging the specialized **ROCm 6.0 ecosystem**.

### 🖥️ Compute Architecture
* **Hardware Accelerators:** AMD High-Throughput Compute Clusters.
* **Software Stack:** PyTorch 2.4.1 compiled with native ROCm 6.0 support (`whl/rocm6.0`).
* **Spatial Processing Integration:** Blending PostgreSQL/PostGIS spatial `GIST` geometry indexing with hardware-accelerated tensor execution matrices.

### 📊 Real-Time Telemetry & Hardware Utilization
By completely bypassing fallback layers, our deep learning frameworks bind directly to the AMD graphics hardware. Under active execution loads (YOLOv8 deep-learning training routines and real-time inference):

* **VRAM Allocation:** Native allocation bounds targeting dedicated memory matrices.
* **GPU Utilization Peak:** Massively parallel processing across independent hardware Compute Units.

> 📋 **Direct Device Verification Log:**
> ```text
> 🚀 Training on device=0 (AMD Radeon / Instinct compute layer via ROCm)
> ```

---

## Repository Structure

```text
ZameenEye-AI/
├── package.json                    # Node.js dependencies & scripts
├── package-lock.json
├── tsconfig.json                   # TypeScript config
├── SETUP.md                        # Backend setup guide
├── README.md                       # This file
├── src/
│   ├── app.ts                      # Express app initialization
│   ├── server.ts                   # Server startup & DB connection
│   ├── config/
│   │   └── database.ts             # TypeORM DataSource config
│   ├── entities/                   # TypeORM entities
│   │   ├── tenant.ts               # Organization/region grouping
│   │   ├── user.ts                 # User profiles
│   │   ├── land.ts                 # Land polygons with geospatial data
│   │   └── disasterEvent.ts        # Hazard events from external sources
│   ├── migrations/                 # Database migrations (numbered sequentially)
│   ├── seeds/                      # Seed data (numbered sequentially)
│   ├── scripts/
│   │   └── runner.ts               # Custom migration/seed runner
│   ├── services/                   # Business logic & DB queries
│   ├── controllers/                # Request/response handling
│   ├── routes/                     # Express route definitions
│   │   ├── spatial.routes.ts       # Spatial intersection checks
│   │   └── ingestFirms.routes.ts   # FIRMS data ingestion
│   └── README.md                   # Backend documentation
├── python/
│   ├── README.md                   # Python module documentation
│   ├── requirements.txt            # Python dependencies
│   ├── ingestion/
│   │   └── firms_fetch.py          # Live FIRMS data sync from NASA
│   ├── inference/
│   │   ├── fireworks_client.py     # LLM inference via Fireworks AI
│   │   └── guardrails.py           # Output validation & safety checks
│   ├── prompts/
│   │   ├── schema.py               # Input/output contract definitions
│   │   └── persona_templates.py    # System prompts & localization
│   ├── tts/
│   │   └── text_to_speech.py       # Multilingual audio generation
│   └── testing/
│       └── sandbox_test.py         # Full pipeline mock tests
└── .gitignore
```

---

## Core Features

### 🌍 Geospatial Intelligence
- **Spatial intersection checks** using PostGIS GIST indexing
- **Multi-source hazard aggregation** (NASA FIRMS, UNOSAT, Copernicus)
- **Real-time event detection** with confidence thresholds

### 🤖 AI-Powered Reasoning
- **LLM-assisted inference** via Fireworks Llama-3-70B
- **Context-aware advisory generation** tailored to risk profiles
- **Output guardrailing** to ensure safety and accuracy

### 🌐 Multilingual Delivery
- **5 supported languages:** Urdu, Hindi, Swahili, Tamil, English
- **Text-to-speech synthesis** in all supported languages
- **Localized personas** that adapt tone and urgency to risk levels

### 🔐 Multi-Tenant Architecture
- **Role-based access control** (farmer, agency_admin)
- **Tenant isolation** with country-specific configurations
- **User profile management** with preferred language & communication channels

---

## API Endpoints

### `/spatial-check` (POST)
**Checks hazards intersecting a farmer's land.**

Request:
```json
{
  "landId": "uuid"
}
```

Response:
```json
{
  "land": {
    "id": "uuid",
    "label": "Field Name",
    "country": "Pakistan | India | Kenya"
  },
  "owner": {
    "name": "John Farmer",
    "phone_number": "+92...",
    "role": "farmer | agency_admin",
    "preferred_language": "urdu | hindi | swahili | tamil | english"
  },
  "has_active_hazard": true,
  "intersecting_events": [
    {
      "source": "nasa_firms | unosat | copernicus",
      "detected_at": "2026-07-04T10:00:00Z",
      "raw_payload": {
        "confidence": 85,
        "intensity": 340
      }
    }
  ]
}
```

**Notes:**
- Returned even when `has_active_hazard` is false (for "all clear" messages).
- `has_active_hazard` is true only if at least one event's confidence exceeds 70%.
- `preferred_language` may be null until user profile is complete.

### `/ingest/firms` (POST)
**Ingest and normalize FIRMS hazard data.**

Request:
```json
{
  "raw_firms_data": { ... }
}
```

---

## Prerequisites

### System Requirements
- **Node.js** 18+ (TypeScript backend)
- **Python** 3.9+ (AI/inference pipeline)
- **PostgreSQL** 13+ with PostGIS extension (geospatial data)
- **npm** or **yarn** (Node.js package manager)

### Environment Variables
Create a `.env` file in the project root with:

```bash
# Database (use Session Pooler connection from Supabase)
DATABASE_URL=postgresql://postgres.<project_ref>:<password>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres

# Fireworks AI (for LLM inference)
FIREWORKS_API_KEY=your_fireworks_api_key_here

# Other services (as needed)
# Add other env vars for external APIs
```

**⚠️ Important:** Use the **Session Pooler** connection string from Supabase, not the Direct connection string. Direct defaults to IPv6, which may fail.

### API Keys & Services
- **Supabase Project** (PostgreSQL + PostGIS)
- **Fireworks AI API key** (for LLM inference)
- **NASA FIRMS API** (for live hazard data)

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yarrbakr/ZameenEye-AI.git
cd ZameenEye-AI
```

### 2. Backend Setup (TypeScript/Node.js)

```bash
# Install Node.js dependencies
npm install

# Create .env file in project root (see Prerequisites section)
# Ensure DATABASE_URL points to your Supabase instance

# Run database migrations
npm run migration:run

# Seed initial data (optional)
npm run seed:run

# Start the backend server
npm run dev
# Server will start on http://localhost:3000
```

**Verification:**
```bash
curl http://localhost:3000/health
# Expected: { "status": "ok" }
```

### 3. Python Setup (AI/Inference Pipeline)

```bash
# Navigate to python directory
cd python

# Create virtual environment
python -m venv venv
source venv/bin/activate          # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Verify setup
python -m testing.sandbox_test
```

### 4. Key Files to Configure
- **`.env`** — Database connection & API keys
- **`src/config/database.ts`** — TypeORM DataSource (usually auto-configured from `DATABASE_URL`)
- **`python/requirements.txt`** — Python dependencies

---

## Quick Local Test Checklist

Use this checklist to verify the system is working end-to-end locally:

### Backend (Node.js)
- [ ] `.env` file exists in project root with valid `DATABASE_URL`
- [ ] `npm install` completed without errors
- [ ] `npm run migration:run` executed successfully
- [ ] `npm run dev` starts server on port 3000
- [ ] `curl http://localhost:3000/health` returns `{ "status": "ok" }`
- [ ] Database tables exist: `tenant`, `user`, `land`, `disaster_event`

### Python Setup
- [ ] Virtual environment created and activated
- [ ] `pip install -r requirements.txt` completed without errors
- [ ] `FIREWORKS_API_KEY` is set in `.env` (or environment)

### Python Module Tests
```bash
# Run from inside python/ directory
python -m testing.sandbox_test       # ✅ Full pipeline with mock data
python -m tts.text_to_speech          # ✅ Generate sample audio in all languages
python -m ingestion.firms_fetch       # ✅ Start live FIRMS data sync
python -m inference.fireworks_client  # ✅ Real Fireworks call (uses API credits)
```

### Integration Verification
- [ ] `POST /spatial-check` endpoint returns mock hazard data
- [ ] Python inference pipeline accepts `HazardPayload` from backend
- [ ] TTS generates audio in all 5 supported languages
- [ ] No TypeORM/database errors in server logs

### Docker (Optional)
```bash
# Build the Python GenAI container
docker build -t zameeneye-genai .

# Run with environment variables
docker run --env-file .env zameeneye-genai
```

---

## Troubleshooting

### Backend Issues

**Error: `ENOENT: no such file or directory, open '.env'`**
- **Cause:** `.env` file is not in the project root (same level as `package.json`).
- **Fix:** Create `.env` in the root directory, not inside `src/`.

**Error: `password authentication failed for user "postgres"`**
- **Cause:** Invalid or expired `DATABASE_URL` in `.env`.
- **Fix:** Verify the connection string from Supabase, use the Session Pooler, not Direct.

**Error: `TypeORM entity filenames must match import casing`**
- **Cause:** Filename case mismatch between import and actual file (common on Windows).
- **Fix:** Keep import casing consistent with actual filenames (`User.ts` not `user.ts`).

**Server starts but endpoints return `Cannot GET /spatial-check`**
- **Cause:** Routes not properly mounted in `app.ts`.
- **Fix:** Verify `spatialRoutes` and `ingestFirmsRoutes` are imported and mounted in `src/app.ts`.

### Python Issues

**Error: `ModuleNotFoundError: No module named 'prompts'`**
- **Cause:** Not running from inside the `python/` directory with the `-m` flag.
- **Fix:** Always run `python -m module.path` from inside `python/` directory.

**Error: `FIREWORKS_API_KEY` not found**
- **Cause:** Environment variable not set or `.env` not loaded.
- **Fix:** Add `FIREWORKS_API_KEY=xxx` to `.env` and ensure it's loaded before running inference.

**Error: `Expected HazardPayload but got unexpected schema`**
- **Cause:** Backend output doesn't match `prompts/schema.py` → `HazardPayload` contract.
- **Fix:** Review `python/README.md` for input contract details; sync with backend team.

### Database Issues

**Error: `gen_random_uuid()` function not found**
- **Cause:** PostgreSQL version < 13 or `pgcrypto` extension not installed.
- **Fix:** Use Supabase (supports natively) or enable `pgcrypto` on your Postgres.

**Error: `PostGIS GIST index not found` (slow spatial queries)**
- **Cause:** Migrations didn't create spatial indexes.
- **Fix:** Ensure `npm run migration:run` completed; verify indexes with `\di` in psql.

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Feature branches:** Create a branch from `main` for each feature/fix.
2. **Commit messages:** Use clear, descriptive messages (e.g., `feat: add multilingual TTS support`).
3. **Testing:** Run the local test checklist before opening a PR.
4. **Documentation:** Update README.md and relevant docs if your changes affect architecture or setup.
5. **Code review:** All PRs require review before merge.

---

## License

This project is licensed under the ISC License. See LICENSE file for details.

---

## Project Contacts & Resources

- **Backend (Kai):** TypeScript/Node.js, API, database
- **AI/Inference (Thammnah):** Python, LLM, multilingual advisories
- **Infrastructure:** AMD ROCm, PostgreSQL/PostGIS, Supabase
- **Repo:** [github.com/yarrbakr/ZameenEye-AI](https://github.com/yarrbakr/ZameenEye-AI)

Last updated: July 2026
