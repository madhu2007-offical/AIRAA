from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# Set up paths
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from data.db import init_db
from routers import reports, risk, routing

app = FastAPI(
    title="AIRAA API",
    description="Adaptive Intelligence for Risk Awareness & Action - Women's Safety Route and Risk Map Engine",
    version="1.0.0"
)

# Configure CORS for local development (Vite React frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend domain e.g. ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup database initialization
@app.on_event("startup")
def startup_event():
    init_db()
    print("Database connection established and tables checked.")

# Include sub-routers
app.include_router(reports.router)
app.include_router(risk.router)
app.include_router(routing.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "AIRAA API",
        "scope": "Delhi Pilot Zone (Hauz Khas & Safdarjung Enclave)",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
