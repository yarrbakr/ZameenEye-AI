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

---

## 🛠️ Hardware & Infrastructure Optimization (AMD Track 3)

ZameenEye-AI is explicitly architected to eliminate traditional CPU-bound processing bottlenecks inherent to large-scale geospatial intelligence platforms. The core AI vision pipeline runs natively on **AMD Silicon** leveraging the specialized **ROCm 6.0 ecosystem**.

### 🖥️ Compute Architecture
* **Hardware Accelerators:** AMD High-Throughput Compute Clusters.
* **Software Stack:** PyTorch 2.4.1 compiled with native ROCm 6.0 support (`whl/rocm6.0`).
* **Spatial Processing Integration:** Blending PostgreSQL/PostGIS spatial `GIST` geometry indexing with hardware-accelerated tensor execution matrices.

### 📊 Real-Time Telemetry & Hardware Utilization
By completely bypassing fallback layers, our deep learning frameworks bind directly to the AMD graphics hardware. Under active execution loads (YOLOv8 deep-learning training routines and real-time inference filters), system metrics via `rocm-smi` verify complete optimization:
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
