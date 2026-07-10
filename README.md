# ZameenEye-AI

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

ZameenEye-AI is a hybrid intelligence platform that translates complex orbital science signals into actionable, on-the-ground decision support. It bridges satellite-derived environmental insights with practical execution workflows for communities, agencies, and operators working in high-risk regions.

> Catchphrase: Turning satellite intelligence into grounded action.

## Table of Contents

- [Why ZameenEye-AI Exists](#why-zameeneye-ai-exists)
- [What This Project Does in One Minute](#what-this-project-does-in-one-minute)
- [Architecture Overview](#architecture-overview)
- [Repository Structure](#repository-structure)
- [Core Features](#core-features)
- [Recent Enhancements](#recent-enhancements)
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

- Ingestion layer: Python-based scripts collect and store hazard data from external sources.
- Intelligence layer: normalization, validation, multilingual rendering, and LLM-assisted reasoning transform raw signals into structured output.
- Application layer: a TypeScript/Node.js backend exposes API endpoints and persists operational data in PostgreSQL through TypeORM.
- Delivery layer: the platform prepares data for downstream alerts, voice delivery, and future automation workflows.

This design makes it easier to evolve the system without tightly coupling data collection, inference, and user-facing services.

## Repository Structure

```text
ZameenEye-AI/
├── package.json
├── tsconfig.json
├── SETUP.md
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   ├── controllers/
│   ├── entities/
│   ├── migrations/
│   ├── routes/
│   ├── scripts/
│   ├── seeds/
│   └── services/
├── python/
│   ├── ingestion/
│   │   └── firms_fetch.py
│   ├── inference/
│   ├── prompts/
│   ├── tts/
│   ├── testing/
│   └── requirements.txt
└── package-lock.json
```

## Core Features

- Multi-language alert delivery: High-fidelity audio synthesis supports Urdu (ur), Hindi (hi), Swahili (sw), Tamil (ta), and English (en) so critical alerts can reach local operators and communities clearly and quickly.
- Low-latency LLM inference: The system uses Fireworks AI to process structured geospatial and hazard data rapidly, turning complex anomalies into actionable insights in near real time.
- Deterministic hazard routing: Strict schema validation is applied at the boundary layer for hazard types such as fire, flood, storm, and disease, helping prevent hallucinated outputs and ensuring reliable backend routing.
- NASA FIRMS wildfire and thermal anomaly ingestion
- Spatial hazard verification for geographic coordinates and land assets
- PostgreSQL-based persistence for entities such as tenants, users, land, and disaster events
- Python-based normalization and inference modules for downstream intelligence workflows
- Text-to-speech preparation and prompt orchestration support

## Recent Enhancements

- Added a multilingual voice and alerting layer through the Python TTS workflow.
- Added LLM-driven inference support through the Python inference layer.
- Strengthened output reliability with schema-based validation for hazard-specific routing.

## API Endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/health` | GET | Health check endpoint |
| `/spatial-check` | POST | Verifies whether a land asset intersects with active hazard data |
| `/ingest/firms` | POST | Triggers FIRMS ingestion workflow |

### Example Requests

#### Health Check

```bash
curl http://localhost:3000/health
```

#### Spatial Check

```bash
curl -X POST http://localhost:3000/spatial-check \
  -H "Content-Type: application/json" \
  -d '{"landId":"<uuid>"}'
```

#### FIRMS Ingestion

```bash
curl -X POST http://localhost:3000/ingest/firms \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Prerequisites

Before getting started, make sure you have:

- Python 3.10+ or newer
- Node.js 18+ and npm
- PostgreSQL running and reachable
- A NASA FIRMS API key (recommended for live ingestion)

## Setup Instructions

### 1. Python Data Engine Setup

Navigate to the Python environment and create a virtual environment:

```bash
cd python
python -m venv .venv
```

Activate the virtual environment:

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Set the FIRMS environment variable if you want to run the ingestion pipeline against live NASA FIRMS data:

```bash
set FIRMS_MAP_KEY=your_firms_api_key
```

Run the ingestion worker locally:

```bash
python ingestion/firms_fetch.py
```

### 2. TypeScript Backend Setup

From the project root, create a `.env` file with your PostgreSQL connection string:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/zameeneye
PORT=3000
```

Install backend dependencies:

```bash
npm install
```

Run database migrations:

```bash
npm run migration:run
```

Start the development server:

```bash
npm run dev
```

The API will be available at:

```text
http://localhost:3000
```

## Quick Local Test Checklist

Use this checklist to verify that the project is working locally:

- [ ] PostgreSQL is running and the database `zameeneye` exists
- [ ] The `.env` file contains a valid `DATABASE_URL`
- [ ] `npm install` completes successfully
- [ ] `npm run migration:run` completes without database errors
- [ ] `npm run dev` starts the backend server
- [ ] `http://localhost:3000/health` returns a healthy response
- [ ] The Python environment is created and dependencies are installed
- [ ] `python ingestion/firms_fetch.py` starts the ingestion workflow

## Troubleshooting

If you run into issues while setting up or running the project, these are the most common fixes:

- Database connection errors: confirm that PostgreSQL is running, the database exists, and the `DATABASE_URL` in the `.env` file is correct.
- Migration failures: verify the database username, password, host, and port, then rerun `npm run migration:run`.
- Python environment errors: make sure the virtual environment is activated and that dependencies are installed with `pip install -r requirements.txt`.
- FIRMS ingestion issues: set `FIRMS_MAP_KEY` for live requests before running the ingestion script.

## Development Notes

- The backend entrypoint is defined in `src/server.ts`.
- Route definitions live under `src/routes/`.
- Database entities and migrations are maintained in `src/entities/` and `src/migrations/`.
- Python ingestion logic is centered around `python/ingestion/firms_fetch.py`.

## Contributing

Contributions are welcome. If you would like to contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request with a clear description of the improvement

## License

This project is licensed under the ISC License.
