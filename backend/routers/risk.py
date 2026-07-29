from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.db import get_all_reports
from ml.risk_model import train_and_score_grid, get_distance_meters

router = APIRouter(prefix="/api/risk-grid", tags=["risk"])

# Global cache of scored cells to avoid retraining on every grid request
_cached_grid: List[Dict[str, Any]] = []

def get_scored_grid_cached(force_refresh: bool = False) -> List[Dict[str, Any]]:
    global _cached_grid
    if not _cached_grid or force_refresh:
        reports = get_all_reports()
        scored_cells, _ = train_and_score_grid(reports)
        _cached_grid = scored_cells
    return _cached_grid

@router.get("", response_model=Dict[str, Any])
def get_risk_grid(refresh: bool = False):
    """
    Returns the grid cell scores as GeoJSON features.
    """
    try:
        scored_cells = get_scored_grid_cached(force_refresh=refresh)
        
        features = []
        for cell in scored_cells:
            # Construct GeoJSON Polygon representing cell boundaries
            feature = {
                "type": "Feature",
                "id": cell["cell_id"],
                "properties": {
                    "cell_id": cell["cell_id"],
                    "risk_score": cell["risk_score"],
                    "risk_tier": cell["risk_tier"],
                    "report_count": cell["report_count"],
                    "avg_severity": cell["avg_severity"],
                    "corroboration_avg": cell["corroboration_avg"],
                    "most_recent_age_days": cell["most_recent_age_days"],
                    "category_breakdown": cell["category_breakdown"]
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [cell["lng_min"], cell["lat_min"]],
                        [cell["lng_max"], cell["lat_min"]],
                        [cell["lng_max"], cell["lat_max"]],
                        [cell["lng_min"], cell["lat_max"]],
                        [cell["lng_min"], cell["lat_min"]]
                    ]]
                }
            }
            features.append(feature)
            
        return {
            "type": "FeatureCollection",
            "features": features
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate risk grid: {str(e)}")

@router.get("/{cell_id}/explain", response_model=Dict[str, Any])
def explain_cell(cell_id: int):
    """
    Returns the evidence behind a cell's risk rating, including nearby incident reports.
    """
    try:
        scored_cells = get_scored_grid_cached()
        
        # Find target cell
        target_cell = None
        for cell in scored_cells:
            if cell["cell_id"] == cell_id:
                target_cell = cell
                break
                
        if not target_cell:
            raise HTTPException(status_code=404, detail=f"Grid cell {cell_id} not found.")
            
        # Retrieve all reports within 150m of cell center
        reports = get_all_reports()
        c_lat = target_cell["lat_mid"]
        c_lng = target_cell["lng_mid"]
        
        nearby_reports = []
        for r in reports:
            dist = get_distance_meters(c_lat, c_lng, r["latitude"], r["longitude"])
            if dist <= 150.0:
                # Add distance attribute for explainability panel
                r_dict = dict(r)
                r_dict["distance_meters"] = round(dist, 1)
                nearby_reports.append(r_dict)
                
        return {
            "cell_info": target_cell,
            "nearby_reports": nearby_reports
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation generation failed: {str(e)}")
