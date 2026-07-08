# ZameenEye-AI

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

ZameenEye-AI is a hybrid intelligence platform that translates complex orbital science signals into actionable, on-the-ground decision support. It bridges satellite-derived environmental insights with practical execution workflows for communities, agencies, and operators working in high-risk regions.

> Catchphrase: Turning satellite intelligence into grounded action.

## Why ZameenEye-AI Exists

Modern satellite and hazard datasets are rich in signal but difficult to operationalize. ZameenEye-AI closes that gap by combining:

- a Python data engine for ingestion, normalization, and inference workflows
- a TypeScript/Node.js backend for orchestration, API exposure, and persistence
- PostgreSQL-backed storage for spatial and operational data

The result is a production-ready foundation for services such as wildfire/thermal anomaly monitoring, spatial hazard checks, and downstream alerting or automation pipelines.

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

- NASA FIRMS wildfire and thermal anomaly ingestion
- Spatial hazard verification for geographic coordinates and land assets
- PostgreSQL-based persistence for entities such as tenants, users, land, and disaster events
- Python-based normalization and inference modules for downstream intelligence workflows
- Text-to-speech preparation and prompt orchestration support

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
