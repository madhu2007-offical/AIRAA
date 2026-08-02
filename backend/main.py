from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import sys
from typing import Dict, Any, List

# Set up paths
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from data.db import init_db
from routers import reports, risk, routing
from ml.nlp_classifier import get_ml_metrics
from ml.route_engine import find_routes, fetch_osm_emergency_features
from routers.risk import get_scored_grid_cached

app = FastAPI(
    title="AIRAA API",
    description="Adaptive Intelligence for Risk Awareness & Action - Chennai Pilot Zone Engine",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()
    print("Database checked and status migrations verified.")

# Include sub-routers
app.include_router(reports.router)
app.include_router(risk.router)
app.include_router(routing.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "AIRAA API",
        "scope": "Chennai Pilot Zone (OMR IT Corridor & Taramani)",
        "docs": "/docs"
    }

@app.get("/api/evaluation", response_model=Dict[str, Any])
def get_evaluation_metrics():
    """
    Computes and returns model evaluation statistics:
    1. Labeled NLP classifier metrics (F1-score, precision, recall)
    2. Route safety metrics (% risk reduction) computed on 3 Chennai origin-destination samples.
    """
    # 1. NLP classifier metrics
    nlp_metrics = get_ml_metrics()
    
    # 2. Compute route safety metrics
    # Sample O-D pairs in the Taramani / OMR pilot zone
    samples = [
        {"name": "Taramani MRTS Station to VHS Hospital", "orig": (12.9862, 80.2421), "dest": (12.9928, 80.2455)},
        {"name": "Tidel Park Junction to SRP Tools Junction", "orig": (12.9892, 80.2465), "dest": (12.9801, 80.2452)},
        {"name": "Perungudi Bus Stop to Kandanchavadi Bus Stop", "orig": (12.9642, 80.2481), "dest": (12.9691, 80.2475)}
      ]
    
    scored_cells = get_scored_grid_cached()
    route_comparisons = []
    
    for sample in samples:
        routes = find_routes(sample["orig"], sample["dest"], scored_cells)
        
        shortest_risk = 0.0
        safest_risk = 0.0
        reduction = 0.0
        
        for r in routes:
            if r["type"] == "shortest" or r["type"] == "shortest_and_safest":
                shortest_risk = r["average_risk"]
            if r["type"] == "safest" or r["type"] == "shortest_and_safest":
                safest_risk = r["average_risk"]
                
        if shortest_risk > 0:
            reduction = round(((shortest_risk - safest_risk) / shortest_risk) * 100, 1)
            reduction = max(0.0, reduction)
            
        route_comparisons.append({
            "pair_name": sample["name"],
            "shortest_risk": shortest_risk,
            "safest_risk": safest_risk,
            "risk_reduction_pct": reduction
        })
        
    return {
        "nlp_classifier": nlp_metrics,
        "route_comparisons": route_comparisons,
        "evaluation_timestamp": datetime.datetime.now().isoformat()
    }

@app.get("/api/emergency", response_model=List[Dict[str, Any]])
def get_emergency_services():
    """
    Returns cached or live OSM nodes tagged as police or hospital within the pilot zone.
    Serves the Emergency Locator component.
    """
    return fetch_osm_emergency_features()
import datetime
