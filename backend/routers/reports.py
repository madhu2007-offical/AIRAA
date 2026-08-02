import datetime
import time
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.db import insert_report, get_all_reports, get_pending_reports, approve_report, reject_report
from ml.nlp_classifier import classify_report
from ml.risk_model import check_report_moderation

router = APIRouter(prefix="/api/reports", tags=["reports"])

# In-memory rate limiting dictionary: client IP -> list of timestamps
rate_limit_records: Dict[str, List[float]] = {}

def check_rate_limit(request: Request):
    """
    Enforces maximum 3 report submissions per minute per client IP.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    
    # Prune timestamps older than 60s
    if client_ip in rate_limit_records:
        rate_limit_records[client_ip] = [t for t in rate_limit_records[client_ip] if now - t < 60.0]
    else:
        rate_limit_records[client_ip] = []
        
    if len(rate_limit_records[client_ip]) >= 3:
        raise HTTPException(
            status_code=429, 
            detail="Rate limit exceeded. Maximum 3 reports per minute allowed."
        )
        
    rate_limit_records[client_ip].append(now)

class ReportCreate(BaseModel):
    category: str
    description: str
    latitude: float
    longitude: float
    severity: int

class ReportResponse(BaseModel):
    id: int
    category: str
    description: str
    latitude: float
    longitude: float
    severity: int
    severity_ml: Optional[int] = None
    category_ml: Optional[str] = None
    sentiment: Optional[str] = None
    timestamp: str
    method: Optional[str] = None
    status: str

@router.get("", response_model=List[ReportResponse])
def get_reports():
    try:
        # Returns only approved reports for public map loading
        reports = get_all_reports(status="approved")
        return reports
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("", response_model=ReportResponse, dependencies=[Depends(check_rate_limit)])
def create_report(report_in: ReportCreate):
    try:
        timestamp = datetime.datetime.now().isoformat()
        
        # 1. Classify report via Gemini or Decision Tree
        nlp_res = classify_report(report_in.description, report_in.severity)
        
        # 2. Check existing reports to determine if minimum corroboration triggers moderation hold
        existing_reports = get_all_reports(status="approved")
        
        report_candidate = {
            "category": report_in.category,
            "description": report_in.description,
            "latitude": report_in.latitude,
            "longitude": report_in.longitude,
            "severity": report_in.severity,
            "severity_ml": nlp_res.get("severity_ml"),
            "category_ml": nlp_res.get("category_ml"),
            "sentiment": nlp_res.get("sentiment"),
            "timestamp": timestamp,
            "method": nlp_res.get("method")
        }
        
        # Apply Trust check
        status = check_report_moderation(report_candidate, existing_reports)
        report_candidate["status"] = status
        
        # 3. Store in SQLite
        report_id = insert_report(report_candidate)
        report_candidate["id"] = report_id
        
        return report_candidate
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit report: {str(e)}")

@router.get("/pending", response_model=List[ReportResponse])
def get_moderation_queue():
    """
    Returns flagged reports currently held in the review queue.
    """
    try:
        return get_pending_reports()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

post_approve_router = APIRouter(prefix="/api/reports", tags=["reports"])
@post_approve_router.post("/{report_id}/approve")
def approve_pending_report(report_id: int):
    """
    Approves a pending report and merges it into the public risk scored grid.
    """
    try:
        approve_report(report_id)
        # Clear risk router global cache to force retraining
        from routers.risk import get_scored_grid_cached
        get_scored_grid_cached(force_refresh=True)
        return {"status": "success", "message": f"Report {report_id} approved."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@post_approve_router.delete("/{report_id}/reject")
def reject_pending_report(report_id: int):
    """
    Rejects and deletes a flagged/spam report.
    """
    try:
        reject_report(report_id)
        return {"status": "success", "message": f"Report {report_id} deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# We include the approve routes in the main router
router.include_router(post_approve_router)
