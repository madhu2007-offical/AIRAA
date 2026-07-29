# AIRAA: Adaptive Intelligence for Risk Awareness & Action

Adaptive Intelligence for Risk Awareness & Action (**AIRAA**) is an AI-powered system designed for the **Girls Hack Day Delhi 2026** hackathon (Problem Statement PS-12: *"Create an AI-powered system that identifies unsafe locations based on community reports and public data"*). 

AIRAA goes beyond displaying heatmaps by fusing crowdsourced safety reports with public street network geometry (OpenStreetMap) to compute **safety-weighted pedestrian routing** between any two points in our pilot zone.

---

## 🚀 Key Features

1. **Incident Reporting**: Submits location-pinned safety reports (harassment, stalking, poor lighting, unsafe infrastructure, assault) into a local SQLite database.
2. **AI/NLP Classification (Gemini)**: Categorizes free-text incident descriptions, extracts threat severity (1–5), and calculates sentiment. If no API key is supplied, the pipeline falls back to an offline rule-based keyword matcher.
3. **Adaptive Risk Scoring Engine**: 
   * Divides the pilot zone into a dense cell grid (~110m resolution).
   * Calculates **Kernel Density Estimation (KDE)** over report locations, applying exponential recency decay ($\lambda = 0.05$) and spatial-temporal corroboration reinforcement.
   * Trains a lightweight **RandomForestClassifier** on per-cell features (density, average severity, night report ratio) to segment cells into *Low*, *Medium*, and *High* risk tiers.
4. **Safety-Aware Pedestrian Routing**:
   * Downloads and caches the pedestrian walking network for the pilot zone using **OSMnx**.
   * Adjusts edge routing weights: $\text{edge\_cost} = \text{distance} \times (1 + \text{risk\_weight} \times \text{cell\_risk\_score})$.
   * Solves Dijkstra paths in **NetworkX** to return the *Shortest Path*, *Safest Path*, and an *Alternative Safest Path*.
5. **Interactive Explainability Dashboard**:
   * Interactive dark-themed Leaflet map.
   * Clicking a grid cell highlights it and opens a sidebar displaying the evidence: report count, average severity, corroboration stats, and the actual raw crowdsourced text reports.

---

## 🛠️ Tech Stack

* **Frontend**: React (Vite) + Tailwind CSS v4 + Leaflet.js (`react-leaflet`)
* **Backend**: Python 3.13 + FastAPI + SQLite
* **ML & Routing**: `scikit-learn` (RandomForest), `pandas`, `scipy`, `NetworkX`, `OSMnx`
* **LLM Integrations**: Google Gemini API (`google-generativeai`)

---

## 📁 Project Structure

```
airaa/
├── frontend/            React (Vite) + Tailwind CSS + Leaflet map
│   ├── src/
│   │   ├── App.jsx      Dashboard components (Map, Sidebar, Forms, Route Option cards)
│   │   ├── index.css    Tailwind imports + custom glassmorphic variables
│   │   └── main.jsx     React bootstrapping
│   ├── index.html       Outfitted fonts and viewport setup
│   └── vite.config.js   Dev server setup + backend API proxy configurations
├── backend/
│   ├── main.py          FastAPI app entrypoint and CORS setups
│   ├── routers/         API endpoint logic (reports, risk, routing)
│   ├── ml/
│   │   ├── risk_model.py     Grid cell definitions, KDE metrics, & RandomForest
│   │   ├── nlp_classifier.py Gemini NLP api & rules-based keyword fallback
│   │   └── route_engine.py   OSMnx cached network loader & NetworkX routing solver
│   └── data/
│       ├── generate_synthetic_reports.py  Faker-based spatial-temporal DB seeder
│       ├── pilot_zone.json   Delhi Pilot Zone bounding box configuration
│       └── pilot_zone_graph.graphml (Generated) Local street network cache
├── requirements.txt     Backend Python dependencies
├── .env.example         Environment template
└── README.md            This project guide
```

---

## ⚙️ Installation & Setup

### Prerequisites
* **Python 3.13+**
* **Node.js 18+**

### 1. Clone & Setup Backend
Open a terminal in the project root:

```bash
# Create a virtual environment
python -m venv .venv

# Activate the virtual environment
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Windows Command Prompt:
.venv\Scripts\activate.bat
# On macOS/Linux:
source .venv/bin/activate

# Install Python requirements
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Create a `.env` file in the project root (you can copy `.env.example`):
```bash
GEMINI_API_KEY=your_google_gemini_api_key_here
```
*Note: If left blank or incorrect, the app automatically runs on the built-in rule-based keyword classifier fallback, which works completely offline!*

### 3. Seed the Database
Run the database generator script to initialize and populate SQLite with 400 simulated incident logs clustered around transit hubs (Metro stations, Hauz Khas Village) during evening/night hours:
```bash
python backend/data/generate_synthetic_reports.py
```

### 4. Setup Frontend
Open a separate terminal window:
```bash
cd frontend
npm install
```

---

## 🏃 Running the Application

### Start the Backend Server
From the activated Python virtual environment terminal in the project root:
```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
*The FastAPI server runs on [http://localhost:8000](http://localhost:8000). Interactive Swagger documentation is available at `/docs`.*

### Start the Frontend Server
From the `frontend` directory terminal:
```bash
npm run dev
```
*The React application opens on [http://localhost:5173](http://localhost:5173).*

---

## ⚖️ Hackathon Scope & Disclaimers

AIRAA is built as an honest, fully functional Minimum Viable Product (MVP). To keep it focused on the core engineering challenge of spatial risk modeling and safety-weighted routing, the following features are **explicitly out-of-scope** for this build:

1. **Simulated Crowdsourced Database**: The ~400 incident reports in this demo are generated synthetically using Faker and centered around high-traffic junctions in the pilot zone (Hauz Khas, Green Park Metro) to simulate crowdsourced data.
2. **No Real Police Data Integration**: Real-time connection to Delhi Police FIR databases requires formal government clearances and is not integrated in this build.
3. **No User Authentication**: Submissions do not require login, phone OTP, or KYC verification.
4. **No Formal Privacy Guarantees**: Crowdsourced reports are displayed directly as coordinates. A production deployment would implement spatial obfuscation (e.g., geomasking coordinates by snapping them to nearest major streets) to preserve reporter anonymity.

---

## 📈 Verification & Testing
We have included a full pipeline validation script to check database queries, ML RandomForest training, and OSMnx/NetworkX routing in a single run:

```bash
python backend/test_pipeline.py
```
This script will test database connections, print cell risk tier distributions, and run a routing solution from Green Park Metro to Hauz Khas Village.
