<div align="center">

<img src="https://via.placeholder.com/160x160.png?text=AIRAA" alt="AIRAA Logo" width="140"/>

# AIRAA
### Adaptive Intelligence for Risk Awareness & Action

**AI-powered safety navigation — routes people around danger, not just around traffic.**

[![Status](https://img.shields.io/badge/status-hackathon%20prototype-orange)]()
[![Python](https://img.shields.io/badge/backend-Python%203-blue)]()
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://frontend-theta-bice-51.vercel.app/)

[Live Demo](https://frontend-theta-bice-51.vercel.app/) · [Report a Bug](../../issues) · [Request a Feature](../../issues)

</div>

---

## Table of Contents

- [About](#about)
- [The Problem](#the-problem)
- [What Makes AIRAA Different](#what-makes-airaa-different)
- [Pilot Zone](#pilot-zone)
- [Features](#features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Model Evaluation](#model-evaluation)
- [Route Safety Results](#route-safety-results)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Ethics, Privacy & Anti-Gaming](#ethics-privacy--anti-gaming)
- [Data Strategy — Current vs. Production](#data-strategy--current-vs-production)
- [Roadmap](#roadmap)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## About

**AIRAA** is an AI-powered safety-intelligence platform that computes safety-weighted pedestrian routing — recommending routes that actively avoid high-risk areas, as a complement to standard navigation apps. It was built for **Girls Hack Day Delhi 2026** (Problem Statement PS-12: *"Create an AI-powered system that identifies unsafe locations based on community reports and public data."*)

Most existing safety apps stop at showing a map with red pins on it. AIRAA goes one step further: it turns that risk information into an actual, actionable route — the same way a maps app routes around traffic, except here it's routing around danger.

## The Problem

Public spaces in Indian cities are unevenly safe for women — and that unevenness is largely invisible, both to someone planning a walk and to the officials who could fix it.

- Official crime statistics under-report harassment, stalking, and groping — most incidents are never formally filed.
- Purely crowdsourced safety apps (pin-drop maps) struggle with **sparse, biased, and stale data** — a handful of unverified reports can permanently paint a neighborhood as dangerous, or a genuinely unsafe area can look "clean" simply because nobody reported it.
- No existing deployed system in India converts a risk score into an **actual safer route** — you're left to interpret a heatmap yourself.

## What Makes AIRAA Different

| Capability | Typical Safety Apps | AIRAA |
|---|---|---|
| Crowdsourced incident intake | ✅ | ✅ |
| NLP understanding of free-text reports | ❌ | ✅ |
| Anti-gaming / corroboration filtering | ❌ | ✅ |
| Converts risk score into a safer **route** | ❌ | ✅ |
| Explainable, evidence-backed risk scores | ❌ | ✅ |
| Privacy-preserving (k-anonymity) display | Rarely | ✅ |

## Pilot Zone

**OMR IT Corridor & Taramani, Chennai** — chosen for its mix of employment hubs, transit stations, and educational campuses.

- Includes Tidel Park, OMR offices, Taramani MRTS, and IIT Madras.
- Bounding box: South `12.960` · West `80.220` · North `12.995` · East `80.265`

## Features

- 📍 **Incident Reporting** — structured + free-text report submission, rate-limited to prevent spam (3 reports/min per IP)
- 🧠 **AI Report Classification** — free-text reports are automatically categorized (harassment, poor lighting, stalking, etc.) and scored for severity
- 🗺️ **Live Risk Grid** — the pilot zone is divided into cells, each with a dynamically computed risk score
- 🛣️ **Safety-Aware Routing** — three route options per trip: shortest, safest, and an alternative — so users see the safety/time trade-off explicitly
- 🚨 **Emergency SOS Locator** — nearest police stations and hospitals, pulled from live OpenStreetMap data
- 🛡️ **Anti-Gaming Protection** — isolated, uncorroborated reports are discounted; high-severity unverified reports go to a human moderator queue
- 🕵️ **Privacy by Design** — individual report locations are hidden unless at least 3 reports exist in that grid cell (k-anonymity)
- 📊 **Live Model Evaluation** — classifier accuracy and route-safety improvements are computed and exposed via API, not hardcoded

## How It Works

1. A user submits an incident report (text + location).
2. The report is classified into a **category** and **severity** — via an LLM (Gemini) if available, or a local ML fallback otherwise.
3. The report is checked for **corroboration** against nearby, recent reports before it meaningfully affects the risk map.
4. High-severity, uncorroborated reports are flagged for **human moderator review** rather than published automatically.
5. Approved reports update the **risk grid** for their area, with each cell's score feeding into route calculations.
6. When a user requests a route, road network edges are weighted by risk, and the system solves for the shortest, safest, and an alternative path.

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌───────────────────┐
│  Frontend   │─────▶│  FastAPI Backend  │─────▶│  Risk Grid Engine  │
│ (React/Vite)│      │                   │      │  (corroboration,   │
└─────────────┘      │  ┌─────────────┐  │      │   k-anonymity,     │
                      │  │ NLP Classi- │  │      │   moderation)      │
                      │  │ fier (Gemini│  │      └─────────┬─────────┘
                      │  │ / TF-IDF +  │  │                │
                      │  │ Decision    │  │                ▼
                      │  │ Tree)       │  │      ┌───────────────────┐
                      │  └─────────────┘  │      │  Routing Engine    │
                      │                   │─────▶│  (OSMnx + NetworkX,│
                      └───────────────────┘      │   Dijkstra/A*)     │
                                                  └───────────────────┘
```

**Layers, at a glance:**

| Layer | Function |
|---|---|
| Data Ingestion | Structured + free-text incident reports; OpenStreetMap road & POI data |
| Trust Scoring | Corroboration check, rate limiting, spam filtering |
| NLP Understanding | Gemini (primary) or TF-IDF + Decision Tree (fallback) for category/severity |
| Risk Modelling | Per-cell risk score, decayed by corroboration and isolation |
| Routing Engine | Weighted graph (OSMnx + NetworkX), Dijkstra/A* for shortest/safest/alternative routes |
| Application Layer | Map UI, report form, route planner, SOS locator |

## Tech Stack

**Backend:** Python 3, FastAPI, scikit-learn (TF-IDF + Decision Tree), Google Gemini API, OSMnx, NetworkX
**Frontend:** React, Vite
**Data:** OpenStreetMap (road network, police/hospital POIs), synthetic incident reports (see [Data Strategy](#data-strategy--current-vs-production))
**Deployment:** Render (backend), Vercel (frontend)

## Model Evaluation

Computed dynamically on backend startup via `/api/evaluation` — not hardcoded.

### NLP Classifier (Decision Tree fallback)

| Metric | Score |
|---|---|
| Training set size | 1,728 sentence variations |
| Validation split | 80/20 train/test |
| Category F1-score | **86.0%** (target: ≥85%) |
| Precision (macro) | **92.2%** |
| Recall (macro) | **85.3%** |
| Severity accuracy | **72.5%** |

> Category classification exceeds target; severity is a known weaker point, as urgency is harder to infer from short free text than category.

## Route Safety Results

| Route | Shortest Path Avg. Risk | Safest Path Avg. Risk | Risk Reduction |
|---|---|---|---|
| Taramani MRTS → VHS Hospital | 86.2% | 54.5% | **−36.8%** |
| Tidel Park → SRP Tools Junction | 90.1% | 61.2% | **−32.0%** |
| Perungudi Bus Stop → Kandanchavadi | 78.4% | 51.0% | **−34.9%** |

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- A Gemini API key (optional — falls back to local classifier if omitted)

### Backend

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Seed synthetic Chennai reports
python backend/data/generate_synthetic_reports.py

# 4. Run the API
uvicorn backend.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # local development
npm run build       # production build
```

**Live demo:** [frontend-theta-bice-51.vercel.app](https://frontend-theta-bice-51.vercel.app/)

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | No | If set, used for primary NLP classification. If absent, falls back to local TF-IDF + Decision Tree model. |
| `DATABASE_URL` | Depends on setup | Connection string if using a persistent database. |
| `PORT` | Set by host (e.g. Render) | Server listens on this port. |

> ⚠️ Never commit a real `.env` file. Keep API keys only in your deployment platform's environment settings.

## Ethics, Privacy & Anti-Gaming

Safety apps carry real risk of misuse if built carelessly. AIRAA's design responds directly to that:

- **k-Anonymity**: individual incident pins are hidden unless at least **3 reports** exist in that grid cell, preventing anyone from tracing a report back to a specific person or moment.
- **Corroboration Discounting**: isolated, uncorroborated reports (no other logs within 150m and 3 days) are discounted by **80%** — a single report can't unilaterally paint an area as dangerous.
- **Human Moderator Queue**: reports with severity ≥4 and zero corroboration are held for manual review before being published.
- **Rate Limiting**: incident submissions are capped per IP to reduce spam and flooding.
- **No objective-truth framing**: risk scores are meant to be read as evidence-backed estimates, not verified fact — a full explainability panel (planned) shows what evidence backs each score.

## Data Strategy — Current vs. Production

**Right now (hackathon build):**
- Incident reports are **synthetic**, generated from template-expanded sentence variations — there is no publicly available, granular women's-safety incident dataset for Indian cities at street level.
- Road network and police/hospital locations are **real**, pulled live from OpenStreetMap.
- The full pipeline (classification → corroboration → risk scoring → routing) is fully functional and would run identically on real data.

**If this moves toward real deployment:**
- Real user-submitted incident reports, bootstrapped via partnerships with local NGOs / women's safety initiatives / campus safety programs.
- Public safety data fusion — NCRB statistics, state police open-data portals, municipal infrastructure records (streetlight/CCTV coverage) where published.
- A time-decayed, multi-signal risk formula (recency-weighted incident density, time-of-day risk buckets, footfall-normalized exposure, external corroboration) replacing the current simpler scoring model.
- Confidence scores shown alongside risk scores, so sparse-data areas aren't presented with false certainty.

## Roadmap

- [ ] Fix production deployment stability (backend cold-start / startup crash)
- [ ] Move risk classifier training to a one-time offline step instead of retraining on every server start
- [ ] Add time-of-day risk buckets (same street, different risk by hour)
- [ ] Add explainability panel — show evidence behind each zone's score
- [ ] Add confidence/data-density indicator per grid cell
- [ ] Migrate to persistent managed database (e.g. Postgres) before handling real user data
- [ ] Device/account-based rate limiting (stronger than IP-based)
- [ ] Expand beyond pilot zone to additional Chennai/Delhi corridors

## Known Limitations

- Current risk data is synthetic, not real-world incident data.
- Severity classification accuracy (72.5%) is meaningfully lower than category accuracy (86%).
- Rate limiting is IP-based and can be bypassed.
- No hard cap on how much longer a "safest" route can be vs. the shortest route.
- Data persistence across deployments/restarts is not yet production-grade.

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to check the [issues page](../../issues).

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgements

- Built for **Girls Hack Day Delhi 2026** (Problem Statement PS-12)
- Road network and POI data — [OpenStreetMap](https://www.openstreetmap.org/) via [OSMnx](https://github.com/gboeing/osmnx)
- Graph routing — [NetworkX](https://networkx.org/)
- NLP classification — [Google Gemini API](https://ai.google.dev/) (primary), scikit-learn (fallback)

---

<div align="center">

Made with care, for safer streets.

</div><div align="center">

<img src="https://via.placeholder.com/160x160.png?text=AIRAA" alt="AIRAA Logo" width="140"/>

# AIRAA
### Adaptive Intelligence for Risk Awareness & Action

**AI-powered safety navigation — routes people around danger, not just around traffic.**

[![Status](https://img.shields.io/badge/status-hackathon%20prototype-orange)]()
[![Python](https://img.shields.io/badge/backend-Python%203-blue)]()
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://frontend-theta-bice-51.vercel.app/)

[Live Demo](https://frontend-theta-bice-51.vercel.app/) · [Report a Bug](../../issues) · [Request a Feature](../../issues)

</div>

---

## Table of Contents

- [About](#about)
- [The Problem](#the-problem)
- [What Makes AIRAA Different](#what-makes-airaa-different)
- [Pilot Zone](#pilot-zone)
- [Features](#features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Model Evaluation](#model-evaluation)
- [Route Safety Results](#route-safety-results)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Ethics, Privacy & Anti-Gaming](#ethics-privacy--anti-gaming)
- [Data Strategy — Current vs. Production](#data-strategy--current-vs-production)
- [Roadmap](#roadmap)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## About

**AIRAA** is an AI-powered safety-intelligence platform that computes safety-weighted pedestrian routing — recommending routes that actively avoid high-risk areas, as a complement to standard navigation apps. It was built for **Girls Hack Day Delhi 2026** (Problem Statement PS-12: *"Create an AI-powered system that identifies unsafe locations based on community reports and public data."*)

Most existing safety apps stop at showing a map with red pins on it. AIRAA goes one step further: it turns that risk information into an actual, actionable route — the same way a maps app routes around traffic, except here it's routing around danger.

## The Problem

Public spaces in Indian cities are unevenly safe for women — and that unevenness is largely invisible, both to someone planning a walk and to the officials who could fix it.

- Official crime statistics under-report harassment, stalking, and groping — most incidents are never formally filed.
- Purely crowdsourced safety apps (pin-drop maps) struggle with **sparse, biased, and stale data** — a handful of unverified reports can permanently paint a neighborhood as dangerous, or a genuinely unsafe area can look "clean" simply because nobody reported it.
- No existing deployed system in India converts a risk score into an **actual safer route** — you're left to interpret a heatmap yourself.

## What Makes AIRAA Different

| Capability | Typical Safety Apps | AIRAA |
|---|---|---|
| Crowdsourced incident intake | ✅ | ✅ |
| NLP understanding of free-text reports | ❌ | ✅ |
| Anti-gaming / corroboration filtering | ❌ | ✅ |
| Converts risk score into a safer **route** | ❌ | ✅ |
| Explainable, evidence-backed risk scores | ❌ | ✅ |
| Privacy-preserving (k-anonymity) display | Rarely | ✅ |

## Pilot Zone

**OMR IT Corridor & Taramani, Chennai** — chosen for its mix of employment hubs, transit stations, and educational campuses.

- Includes Tidel Park, OMR offices, Taramani MRTS, and IIT Madras.
- Bounding box: South `12.960` · West `80.220` · North `12.995` · East `80.265`

## Features

- 📍 **Incident Reporting** — structured + free-text report submission, rate-limited to prevent spam (3 reports/min per IP)
- 🧠 **AI Report Classification** — free-text reports are automatically categorized (harassment, poor lighting, stalking, etc.) and scored for severity
- 🗺️ **Live Risk Grid** — the pilot zone is divided into cells, each with a dynamically computed risk score
- 🛣️ **Safety-Aware Routing** — three route options per trip: shortest, safest, and an alternative — so users see the safety/time trade-off explicitly
- 🚨 **Emergency SOS Locator** — nearest police stations and hospitals, pulled from live OpenStreetMap data
- 🛡️ **Anti-Gaming Protection** — isolated, uncorroborated reports are discounted; high-severity unverified reports go to a human moderator queue
- 🕵️ **Privacy by Design** — individual report locations are hidden unless at least 3 reports exist in that grid cell (k-anonymity)
- 📊 **Live Model Evaluation** — classifier accuracy and route-safety improvements are computed and exposed via API, not hardcoded

## How It Works

1. A user submits an incident report (text + location).
2. The report is classified into a **category** and **severity** — via an LLM (Gemini) if available, or a local ML fallback otherwise.
3. The report is checked for **corroboration** against nearby, recent reports before it meaningfully affects the risk map.
4. High-severity, uncorroborated reports are flagged for **human moderator review** rather than published automatically.
5. Approved reports update the **risk grid** for their area, with each cell's score feeding into route calculations.
6. When a user requests a route, road network edges are weighted by risk, and the system solves for the shortest, safest, and an alternative path.

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌───────────────────┐
│  Frontend   │─────▶│  FastAPI Backend  │─────▶│  Risk Grid Engine  │
│ (React/Vite)│      │                   │      │  (corroboration,   │
└─────────────┘      │  ┌─────────────┐  │      │   k-anonymity,     │
                      │  │ NLP Classi- │  │      │   moderation)      │
                      │  │ fier (Gemini│  │      └─────────┬─────────┘
                      │  │ / TF-IDF +  │  │                │
                      │  │ Decision    │  │                ▼
                      │  │ Tree)       │  │      ┌───────────────────┐
                      │  └─────────────┘  │      │  Routing Engine    │
                      │                   │─────▶│  (OSMnx + NetworkX,│
                      └───────────────────┘      │   Dijkstra/A*)     │
                                                  └───────────────────┘
```

**Layers, at a glance:**

| Layer | Function |
|---|---|
| Data Ingestion | Structured + free-text incident reports; OpenStreetMap road & POI data |
| Trust Scoring | Corroboration check, rate limiting, spam filtering |
| NLP Understanding | Gemini (primary) or TF-IDF + Decision Tree (fallback) for category/severity |
| Risk Modelling | Per-cell risk score, decayed by corroboration and isolation |
| Routing Engine | Weighted graph (OSMnx + NetworkX), Dijkstra/A* for shortest/safest/alternative routes |
| Application Layer | Map UI, report form, route planner, SOS locator |

## Tech Stack

**Backend:** Python 3, FastAPI, scikit-learn (TF-IDF + Decision Tree), Google Gemini API, OSMnx, NetworkX
**Frontend:** React, Vite
**Data:** OpenStreetMap (road network, police/hospital POIs), synthetic incident reports (see [Data Strategy](#data-strategy--current-vs-production))
**Deployment:** Render (backend), Vercel (frontend)

## Model Evaluation

Computed dynamically on backend startup via `/api/evaluation` — not hardcoded.

### NLP Classifier (Decision Tree fallback)

| Metric | Score |
|---|---|
| Training set size | 1,728 sentence variations |
| Validation split | 80/20 train/test |
| Category F1-score | **86.0%** (target: ≥85%) |
| Precision (macro) | **92.2%** |
| Recall (macro) | **85.3%** |
| Severity accuracy | **72.5%** |

> Category classification exceeds target; severity is a known weaker point, as urgency is harder to infer from short free text than category.

## Route Safety Results

| Route | Shortest Path Avg. Risk | Safest Path Avg. Risk | Risk Reduction |
|---|---|---|---|
| Taramani MRTS → VHS Hospital | 86.2% | 54.5% | **−36.8%** |
| Tidel Park → SRP Tools Junction | 90.1% | 61.2% | **−32.0%** |
| Perungudi Bus Stop → Kandanchavadi | 78.4% | 51.0% | **−34.9%** |

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- A Gemini API key (optional — falls back to local classifier if omitted)

### Backend

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Seed synthetic Chennai reports
python backend/data/generate_synthetic_reports.py

# 4. Run the API
uvicorn backend.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # local development
npm run build       # production build
```

**Live demo:** [frontend-theta-bice-51.vercel.app](https://frontend-theta-bice-51.vercel.app/)

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | No | If set, used for primary NLP classification. If absent, falls back to local TF-IDF + Decision Tree model. |
| `DATABASE_URL` | Depends on setup | Connection string if using a persistent database. |
| `PORT` | Set by host (e.g. Render) | Server listens on this port. |

> ⚠️ Never commit a real `.env` file. Keep API keys only in your deployment platform's environment settings.

## Ethics, Privacy & Anti-Gaming

Safety apps carry real risk of misuse if built carelessly. AIRAA's design responds directly to that:

- **k-Anonymity**: individual incident pins are hidden unless at least **3 reports** exist in that grid cell, preventing anyone from tracing a report back to a specific person or moment.
- **Corroboration Discounting**: isolated, uncorroborated reports (no other logs within 150m and 3 days) are discounted by **80%** — a single report can't unilaterally paint an area as dangerous.
- **Human Moderator Queue**: reports with severity ≥4 and zero corroboration are held for manual review before being published.
- **Rate Limiting**: incident submissions are capped per IP to reduce spam and flooding.
- **No objective-truth framing**: risk scores are meant to be read as evidence-backed estimates, not verified fact — a full explainability panel (planned) shows what evidence backs each score.

## Data Strategy — Current vs. Production

**Right now (hackathon build):**
- Incident reports are **synthetic**, generated from template-expanded sentence variations — there is no publicly available, granular women's-safety incident dataset for Indian cities at street level.
- Road network and police/hospital locations are **real**, pulled live from OpenStreetMap.
- The full pipeline (classification → corroboration → risk scoring → routing) is fully functional and would run identically on real data.

**If this moves toward real deployment:**
- Real user-submitted incident reports, bootstrapped via partnerships with local NGOs / women's safety initiatives / campus safety programs.
- Public safety data fusion — NCRB statistics, state police open-data portals, municipal infrastructure records (streetlight/CCTV coverage) where published.
- A time-decayed, multi-signal risk formula (recency-weighted incident density, time-of-day risk buckets, footfall-normalized exposure, external corroboration) replacing the current simpler scoring model.
- Confidence scores shown alongside risk scores, so sparse-data areas aren't presented with false certainty.

## Roadmap

- [ ] Fix production deployment stability (backend cold-start / startup crash)
- [ ] Move risk classifier training to a one-time offline step instead of retraining on every server start
- [ ] Add time-of-day risk buckets (same street, different risk by hour)
- [ ] Add explainability panel — show evidence behind each zone's score
- [ ] Add confidence/data-density indicator per grid cell
- [ ] Migrate to persistent managed database (e.g. Postgres) before handling real user data
- [ ] Device/account-based rate limiting (stronger than IP-based)
- [ ] Expand beyond pilot zone to additional Chennai/Delhi corridors

## Known Limitations

- Current risk data is synthetic, not real-world incident data.
- Severity classification accuracy (72.5%) is meaningfully lower than category accuracy (86%).
- Rate limiting is IP-based and can be bypassed.
- No hard cap on how much longer a "safest" route can be vs. the shortest route.
- Data persistence across deployments/restarts is not yet production-grade.

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to check the [issues page](../../issues).

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgements

- Built for **Girls Hack Day Delhi 2026** (Problem Statement PS-12)
- Road network and POI data — [OpenStreetMap](https://www.openstreetmap.org/) via [OSMnx](https://github.com/gboeing/osmnx)
- Graph routing — [NetworkX](https://networkx.org/)
- NLP classification — [Google Gemini API](https://ai.google.dev/) (primary), scikit-learn (fallback)

---

<div align="center">

Made with care, for safer streets.

</div>
