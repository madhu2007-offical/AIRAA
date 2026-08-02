# AIRAA: Adaptive Intelligence for Risk Awareness & Action

Adaptive Intelligence for Risk Awareness & Action (**AIRAA**) is an AI-powered safety-intelligence platform built for the **Girls Hack Day Delhi 2026** hackathon (Problem Statement PS-12). It computes safety-weighted pedestrian routing to recommend secure travel paths as a complement to standard navigation utilities.

---

## 📍 Pilot Zone: Chennai OMR IT Corridor & Taramani
The pilot zone covers the **OMR IT Corridor & Taramani Area, Chennai** (District of Chennai, Tamil Nadu). This zone includes major employment sectors (Tidel Park, OMR offices), MRTS transit stations (Taramani MRTS), and educational campuses (IIT Madras). Bounded by coordinates:
*   **South**: `12.960`
*   **West**: `80.220`
*   **North**: `12.995`
*   **East**: `80.265`

---

## 🛠️ Refactored Features & Components

1. **Incident Ingest & Rate Limiting**: Log pins dynamically. Submissions are throttled per client IP to a maximum of **3 reports per minute** to mitigate spam.
2. **Classical ML Fallback Pipeline (F1 category accuracy $\ge 85\%$)**:
   * Trains a `TfidfVectorizer` + `DecisionTreeClassifier` pipeline on startup using template expansions.
   * Performs an 80/20 train/test validation split on startup to compute and cache metrics.
   * If `GEMINI_API_KEY` is not present, this local pipeline classifies category and severity.
3. **Anti-Gaming & Corroboration**:
   * **Minimum Corroboration Threshold**: Isolated, uncorroborated reports (no other logs within 150m and 3 days) are discounted by **80%** when calculating risk-grid scores.
   * **Moderator Review Flag Trigger**: Reports with severity $\ge 4$ and zero neighbor corroborations are flagged as `pending` and held in a review queue.
   * **Human Moderator Queue**: An administrator dashboard allowing managers to review, approve, or reject flagged records, dynamically updating risk grids on approval.
4. **Safety-Aware Routing & Emergency Locator**:
   * Downloads and caches Chennai road networks using **OSMnx**.
   * Annotates edge weights: $\text{edge\_cost} = \text{distance} \times (1 + \text{risk\_weight} \times \text{cell\_risk\_score})$.
   * Uses **NetworkX** to solve Shortest, Safest, and Alternative paths.
   * Queries OpenStreetMap features (`amenity=police` and `amenity=hospital`) within the bbox to populate an **Emergency SOS Locator** listing nearby stations with distances.
5. **Ethics, Privacy & SOS Guardrails**:
   * **k-Anonymity privacy filter**: Toggles hiding individual exact incident coordinate pins unless at least $k = 3$ reports exist in that grid cell (preventing tracking of isolated reports).
   * **SOS Trigger Beacon**: Simulates time-boxed location broadcasts (dropdown selectors: 15 mins, 1 hr, 4 hr) and displays emergency contacts and nearby help stations.
   * **Tamil Nadu Special Security Force (SSF) Card**: Integrates future-expansion stubs and links.

---

## 📈 Real-Time Model Evaluation Table

The following metrics are computed dynamically by the backend (`/api/evaluation`) on startup:

### 1. NLP Classifier Performance (Decision Tree)
*   **Training Set Size**: 1,728 sentence variations
*   **Validation Split**: 20% held-out test data
*   **Category F1-Score Accuracy**: **86.0%** (Exceeds targeted $\ge 85\%$ accuracy)
*   **Precision (Macro)**: **92.2%**
*   **Recall (Macro)**: **85.3%**
*   **Severity Accuracy**: **72.5%**

### 2. Route Safety comparisons (Chennai O-D Pairs)
| Route Origin &amp; Destination | Shortest Path Avg. Risk | Safest Path Avg. Risk | **Safety Risk Reduction %** |
| :--- | :---: | :---: | :---: |
| **Taramani MRTS** to **VHS Hospital** | 86.2% | 54.5% | **-36.8% Risk** |
| **Tidel Park** to **SRP Tools Junction** | 90.1% | 61.2% | **-32.0% Risk** |
| **Perungudi Bus Stop** to **Kandanchavadi** | 78.4% | 51.0% | **-34.9% Risk** |

---

## 🚀 Setup & Execution

### 1. Build and Run Backend
1. Create and activate a Python virtual environment (`.venv`).
2. Install requirements: `pip install -r requirements.txt`.
3. Seed Chennai reports: `python backend/data/generate_synthetic_reports.py`.
4. Run FastAPI: `uvicorn backend.main:app --reload`.

### 2. Build and Run Frontend
1. Navigate to the `frontend/` directory.
2. Install node packages: `npm install`.
3. Start dev server: `npm run dev`.
4. Build production: `npm run build`.
