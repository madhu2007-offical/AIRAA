<div align="center">
 "<img width="1672" height="941" alt="ChatGPT Image Aug 8, 2026, 11_24_44 AM" src="https://github.com/user-attachments/assets/3c5d67f8-8ce5-480c-8171-7f2fbd978486" />
" />

<br/>

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![OSMnx](https://img.shields.io/badge/OSMnx-NetworkX-3E863E?style=for-the-badge&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-classifier-8E75B2?style=for-the-badge&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Hackathon_Build-ED1C24?style=for-the-badge)

</div>

<br/>

<h1 align="center">AIRAA</h1>
<p align="center"><i>Adaptive Intelligence for Risk Awareness & Action — an AI-Powered Safety-Aware Navigation System</i></p>

<p align="center">
  <a href="#the-problem">The Problem</a> •
  <a href="#the-gap">The Gap</a> •
  <a href="#key-innovation">Key Innovation</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#what-it-scores">What It Scores</a> •
  <a href="#quickstart">Quickstart</a> •
  <a href="#demo">Demo</a> •
  <a href="#scope--limitations">Scope</a> •
  <a href="#data-strategy">Data Strategy</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#team">Team</a>
</p>

<p align="center">
  <b>Girls Hack Day Delhi 2026 · Problem Statement PS-12</b>
</p>

---

## The Problem

Public spaces in Indian cities remain unevenly safe for women — but that unevenness is largely invisible, both to someone planning a journey and to the municipal bodies that could actually fix it.

Official crime statistics under-report harassment: most incidents of eve-teasing, stalking, and groping are never formally filed. Purely crowdsourced safety apps struggle with sparse, biased, and stale data — a handful of unverified pins can permanently paint a neighborhood as dangerous, while genuinely unsafe streets stay invisible simply because nobody reported them.

**The data problem is solved in pieces. Nobody has shipped the whole pipeline.**

## The Gap

Crowdsourced safety-reporting apps (Safecity, SafetiPin) and official panic-button apps (Himmat) already exist in India, and academic literature has separately solved crime-hotspot prediction (KDE/STKDE), NLP-based safety-text classification, and safety-aware routing. But no reviewed system — deployed or academic — closes all of these gaps **together**:

| Capability | Safecity / SafetiPin | Himmat | Academic KDE/NLP models | AIRAA |
|---|:---:|:---:|:---:|:---:|
| Crowdsourced incident intake | ✅ | Panic button only | ❌ | ✅ |
| NLP understanding of free-text reports | ❌ | ❌ | Partial | ✅ |
| Anti-gaming / corroboration filtering | Not published | ❌ | Rarely | ✅ |
| Predictive (not just descriptive) risk model | ❌ raw pin density | ❌ | ✅ | ✅ |
| **Converts risk score into a safer route** | ❌ | ❌ | ❌ | ✅ |
| Explainable, evidence-backed risk score | ❌ | ❌ | Partial | ✅ (full panel planned) |

The action layer — turning a risk score into a safer route rather than leaving the user to interpret a heatmap — is the least-explored piece of all. **That's the specific gap AIRAA is built to close.**

## Key Innovation

> AIRAA doesn't just show where it's unsafe — it changes the route. Risk isn't a colour overlay sitting on top of the map; it's an actual cost fed into the pathfinding algorithm, so the "safer" route recommendation is mathematically derived, not manually curated.

Rather than trusting every user-submitted pin at face value, AIRAA puts a **trust and corroboration layer in front of the risk model** — isolated, unverified reports are discounted, high-severity unverified claims go to a human moderator, and individual report locations are hidden behind a k-anonymity threshold. Every risk score is meant to be read as *evidence-backed*, not asserted as objective fact.

**The infrastructure for safer cities already exists — streets, transit, hospitals, police stations. What's been missing is the intelligence layer that turns scattered, low-trust reports into a route you can actually act on. We're building it.**

## How It Works

```
Incident Report (text + location)
        │
        ▼
NLP Classifier  ──  Gemini (primary) / TF-IDF + Decision Tree (fallback)
        │
        ▼
Category + Severity
        │
        ▼
Corroboration & Trust Scoring  ──  150m / 3-day proximity check, k-anonymity, rate limiting
        │
        ├──────────────┐
        ▼              ▼
 Auto-Published    Flagged for Human
  to Risk Grid       Moderator Review
        │              │
        └──────┬───────┘
               ▼
        Risk-Weighted Grid
   edge_cost = distance × (1 + risk_weight × cell_risk_score)
               │
               ▼
   Routing Engine  ──  OSMnx + NetworkX, Dijkstra / A*
               │
               ▼
   Shortest / Safest / Alternative Routes + Emergency SOS Locator
```

**Deterministic trust filtering sits in front of the risk model — not instead of it.**

## What It Scores

Every incident report is classified into a category and severity, sourced from real report text — not asserted without evidence:

| Category | Example Trigger Signal | Handling |
|---|---|:---:|
| Harassment / stalking | Free-text description, keyword + context signals | Classified, corroboration-checked |
| Poor lighting / infrastructure | Environmental description in report text | Classified, feeds risk grid |
| Isolated / low-footfall area | Location + time-of-day pattern | Feeds risk weighting |
| High-severity, uncorroborated report | Severity ≥ 4, zero nearby matching reports | 🔴 Routed to human moderator queue |
| Isolated, uncorroborated report | No other logs within 150m / 3 days | 🟡 Discounted 80% in risk scoring |
| Duplicate / spam submission | > 3 reports per minute from one IP | 🟢 Rate-limited at ingestion |

Every published risk score traces back to real report evidence and a corroboration state — no score is shown without something backing it.

## Quickstart

```bash
git clone https://github.com/madhu2007-offical/AIRAA.git
cd AIRAA

# Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python backend/data/generate_synthetic_reports.py
uvicorn backend.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

**Sample output:**
 src="<img width="1918" height="937" alt="Screenshot 2026-08-08 112014" src="https://github.com/user-attachments/assets/554da9ce-5e45-4aa7-8783-19160a435a24" />
" />

### Run with Docker (optional)

```bash
docker build -t airaa .
docker run --rm -p 8000:8000 --env-file .env airaa
```

## Demo

**[Live Demo](https://frontend-theta-bice-51.vercel.app/)**

## Scope & Limitations

We scoped this narrow on purpose — **narrow and correct beats broad and wrong.**

**What it does**
- Classifies free-text incident reports into category + severity using an LLM (Gemini) or a local ML fallback
- Filters reports through corroboration and rate-limit checks before they affect the public risk map
- Computes a live, per-cell risk grid over the pilot zone
- Solves shortest, safest, and alternative routes over a real Chennai road network
- Surfaces nearby police stations and hospitals via live OpenStreetMap data
- Reports classifier accuracy and route-safety metrics dynamically via `/api/evaluation` — not hardcoded numbers

**What it doesn't do (yet)**
- Use real-world incident data — current reports are synthetic, template-generated for demo purposes
- Show a full explainability panel (evidence breakdown per zone) — currently a roadmap item
- Cap the maximum acceptable detour length for the "safest" route vs. the shortest
- Persist data reliably across redeploys — current storage is not yet production-grade
- Authenticate reporters — current rate limiting is IP-based, which is bypassable

## Data Strategy

Real, verified, granular incident data isn't obtainable in a hackathon timeframe, and no judge realistically expects it. AIRAA's approach:

- **Real data**: road network and police/hospital locations are pulled live from **OpenStreetMap** via OSMnx — the geography is genuine.
- **Synthetic data**: incident reports are generated from template-expanded sentence variations (1,728 training examples for the NLP classifier), clearly labelled as simulated crowdsourced input — standard, expected hackathon practice.
- **Production path**: real user-submitted reports (bootstrapped via NGO/campus safety partnerships), fused with public aggregate data (NCRB, state police open-data portals, municipal streetlight/CCTV records) where available.

## Tech Stack

`Python 3.11` · `FastAPI` · `scikit-learn (TF-IDF + Decision Tree)` · `Google Gemini API` · `OSMnx` · `NetworkX` · `React` · `Vite` · `Docker`

## Project Structure

```
AIRAA/
├── backend/
│   ├── main.py                 # FastAPI entrypoint
│   ├── data/
│   │   └── generate_synthetic_reports.py
│   ├── classifier/              # Gemini + TF-IDF/Decision Tree pipeline
│   ├── risk_grid/                 # corroboration, k-anonymity, moderation queue
│   └── routing/                     # OSMnx graph + NetworkX shortest-path logic
├── cache/                             # cached road network graph
├── frontend/
│   ├── src/                             # React/Vite app
│   └── package.json
├── .env.example
├── render.yaml
├── requirements.txt
└── README.md
```

## Roadmap

- [x] NLP classification pipeline — Gemini primary, TF-IDF + Decision Tree fallback
- [x] Corroboration-based risk scoring + k-anonymity display filter
- [x] Safety-weighted routing (shortest / safest / alternative)
- [x] Live model evaluation endpoint
- [ ] Fix production deployment stability (backend startup crash on Render)
- [ ] Explainability panel — show evidence behind each zone's score
- [ ] Confidence/data-density indicator per grid cell
- [ ] Time-of-day risk buckets (same street, different risk by hour)
- [ ] Migrate to persistent managed database before handling real user data
- [ ] Device/account-based rate limiting
- [ ] Expand beyond pilot zone to additional Chennai/Delhi corridors

## Team

<div align="center">

### *Team Falcon*

**Girls Hack Day Delhi 2026 · Problem Statement PS-12**

</div>

## License

This project is released under the [MIT License](LICENSE).

---

<div align="center">
<i>"See the city honestly. Act on it in the moment. Feed it back to the people who can fix it."</i>
</div>
