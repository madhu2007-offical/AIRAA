import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.db import insert_report, get_all_reports
from ml.nlp_classifier import classify_report

router = APIRouter(prefix="/api/reports", tags=["reports"])

class ReportCreate(BaseModel):
    category: str = Field(..., description="User selected category")
    description: str = Field(..., description="Detailed free-text incident description")
    latitude: float = Field(..., description="Latitude coordinate of incident")
    longitude: float = Field(..., description="Longitude coordinate of incident")
    severity: int = Field(..., ge=1, le=5, description="User slider rating from 1 to 5")

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

@router.get("", response_model=List[ReportResponse])
def get_reports():
    try:
        reports = get_all_reports()
        return reports
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("", response_model=ReportResponse)
def create_report(report_in: ReportCreate):
    try:
        # 1. Capture current timestamp in ISO format
        timestamp = datetime.datetime.now().isoformat()
        
        # 2. Run NLP Classification (Gemini or Keyword Fallback)
        nlp_res = classify_report(report_in.description, report_in.severity)
        
        # 3. Assemble report object
        report_data = {
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
        
        # 4. Insert into database
        report_id = insert_report(report_data)
        report_data["id"] = report_id
        
        return report_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit report: {str(e)}")
