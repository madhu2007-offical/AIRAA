from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Tuple, Dict, Any
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from routers.risk import get_scored_grid_cached
from ml.route_engine import find_routes

router = APIRouter(prefix="/api/route", tags=["routing"])

class RouteRequest(BaseModel):
    origin: Tuple[float, float] = Field(..., description="[Latitude, Longitude] of route start point")
    destination: Tuple[float, float] = Field(..., description="[Latitude, Longitude] of route end point")

class RouteOptionResponse(BaseModel):
    name: str
    type: str
    coordinates: List[List[float]] = Field(..., description="Array of [longitude, latitude] coordinates")
    distance_meters: float
    duration_minutes: float
    average_risk: float

@router.post("", response_model=List[RouteOptionResponse])
def get_routes(req: RouteRequest):
    """
    Computes multiple route paths (shortest vs safest vs alternative) between start and end coordinates.
    """
    try:
        # 1. Fetch current scored grid (refreshes if needed)
        scored_cells = get_scored_grid_cached()
        
        # 2. Run NetworkX Dijkstra safety route engine
        routes = find_routes(req.origin, req.destination, scored_cells)
        
        if not routes:
            raise HTTPException(status_code=400, detail="Could not compute walking path. Verify that coordinates are inside the pilot zone.")
            
        return routes
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Routing failure: {str(e)}")
