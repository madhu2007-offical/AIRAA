import os
import math
import datetime
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple
from sklearn.ensemble import RandomForestClassifier

# Bounding box configuration for OMR & Taramani, Chennai
BBOX = {
    "south": 12.960,
    "west": 80.220,
    "north": 12.995,
    "east": 80.265
}

# Grid parameters
LAT_STEP = 0.0010  # ~111 meters
LNG_STEP = 0.0011  # ~113 meters

def get_distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Computes distance in meters between two coordinates using flat-earth approximation.
    """
    lat_mid = math.radians((lat1 + lat2) * 0.5)
    dy = (lat1 - lat2) * 111000.0
    dx = (lng1 - lng2) * 111000.0 * math.cos(lat_mid)
    return math.sqrt(dx * dx + dy * dy)

def generate_grid_cells() -> List[Dict[str, Any]]:
    """
    Generates grid cells covering the Chennai pilot zone.
    """
    cells = []
    cell_id = 0
    
    lat = BBOX["south"]
    while lat < BBOX["north"]:
        lng = BBOX["west"]
        while lng < BBOX["east"]:
            cells.append({
                "cell_id": cell_id,
                "lat_min": lat,
                "lat_max": lat + LAT_STEP,
                "lng_min": lng,
                "lng_max": lng + LNG_STEP,
                "lat_mid": lat + (LAT_STEP / 2),
                "lng_mid": lng + (LNG_STEP / 2)
            })
            cell_id += 1
            lng += LNG_STEP
        lat += LAT_STEP
        
    return cells

def analyze_corroboration(reports: List[Dict[str, Any]], distance_threshold: float = 150.0, days_threshold: float = 3.0) -> List[int]:
    """
    For each report, count the number of other approved reports submitted within distance_threshold meters 
    and days_threshold days.
    """
    corroboration_counts = []
    
    # Parse timestamps
    parsed_times = []
    for r in reports:
        try:
            parsed_times.append(datetime.datetime.fromisoformat(r["timestamp"]))
        except ValueError:
            parsed_times.append(datetime.datetime.now())
            
    n = len(reports)
    for i in range(n):
        count = 0
        r_i = reports[i]
        t_i = parsed_times[i]
        
        for j in range(n):
            if i == j:
                continue
            r_j = reports[j]
            t_j = parsed_times[j]
            
            # Check time proximity
            time_diff_days = abs((t_i - t_j).total_seconds()) / 86400.0
            if time_diff_days <= days_threshold:
                # Check spatial proximity
                dist = get_distance_meters(r_i["latitude"], r_i["longitude"], r_j["latitude"], r_j["longitude"])
                if dist <= distance_threshold:
                    count += 1
                    
        corroboration_counts.append(count)
        
    return corroboration_counts

def check_report_moderation(report_in: Dict[str, Any], existing_reports: List[Dict[str, Any]]) -> str:
    """
    Anti-gaming heuristic:
    Flags a report as 'pending' for moderation if severity >= 4 and has 0 corroborating reports
    within 200 meters. Prevents isolated false alarms from single-handedly upgrading grid cells.
    """
    if report_in["severity"] < 4:
        return "approved"
        
    has_neighbor = False
    for r in existing_reports:
        # Only check against approved reports
        if r.get("status", "approved") != "approved":
            continue
        dist = get_distance_meters(report_in["latitude"], report_in["longitude"], r["latitude"], r["longitude"])
        if dist <= 200.0:
            has_neighbor = True
            break
            
    return "approved" if has_neighbor else "pending"

def train_and_score_grid(reports: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], RandomForestClassifier]:
    """
    Computes KDE features with corroboration weighting and trains a RandomForest model to classify cell risk tiers.
    """
    cells = generate_grid_cells()
    
    # Filter reports to use ONLY approved logs for public scoring
    approved_reports = [r for r in reports if r.get("status", "approved") == "approved"]
    
    if not approved_reports:
        for cell in cells:
            cell.update({
                "risk_score": 0.0,
                "risk_tier": "low",
                "report_count": 0,
                "avg_severity": 0.0,
                "corroboration_avg": 0.0,
                "most_recent_age_days": 999.0,
                "category_breakdown": {}
            })
        return cells, None

    # Compute corroboration counts
    corroboration_counts = analyze_corroboration(approved_reports)
    for idx, r in enumerate(approved_reports):
        r["corroboration_count"] = corroboration_counts[idx]
        
    now = datetime.datetime.now()
    cell_features = []
    
    # Gaussian kernel parameter (bandwidth in meters)
    h = 120.0 
    time_decay_rate = 0.05
    
    for cell in cells:
        c_lat = cell["lat_mid"]
        c_lng = cell["lng_mid"]
        
        kde_score = 0.0
        weighted_severity_sum = 0.0
        weight_sum = 0.0
        
        report_count_nearby = 0
        corroboration_sum = 0
        min_age_days = 99.0
        
        category_counts = {}
        night_reports = 0
        
        for idx, r in enumerate(approved_reports):
            dist = get_distance_meters(c_lat, c_lng, r["latitude"], r["longitude"])
            if dist > 400.0:
                continue
                
            spatial_kernel = math.exp(-(dist ** 2) / (2 * (h ** 2)))
            
            try:
                t_report = datetime.datetime.fromisoformat(r["timestamp"])
            except ValueError:
                t_report = now
            age_days = max(0.0, (now - t_report).total_seconds() / 86400.0)
            temporal_decay = math.exp(-time_decay_rate * age_days)
            
            # Trust Heuristic: Minimum-Corroboration Threshold
            # Discount uncorroborated single reports by 80% to mitigate gaming
            if r["corroboration_count"] == 0:
                corroboration_multiplier = 0.20
            else:
                corroboration_multiplier = 1.0 + (0.25 * r["corroboration_count"])
            
            # Weighted calculation
            r_weight = spatial_kernel * temporal_decay * corroboration_multiplier
            kde_score += r_weight
            
            sev = r.get("severity_ml") if r.get("severity_ml") is not None else r["severity"]
            weighted_severity_sum += sev * r_weight
            weight_sum += r_weight
            
            if dist <= 150.0:
                report_count_nearby += 1
                corroboration_sum += r["corroboration_count"]
                if age_days < min_age_days:
                    min_age_days = age_days
                    
                cat = r.get("category_ml") or r["category"]
                category_counts[cat] = category_counts.get(cat, 0) + 1
                
                hour = t_report.hour
                if hour >= 18 or hour < 3:
                    night_reports += 1

        avg_severity = (weighted_severity_sum / weight_sum) if weight_sum > 0 else 0.0
        corroboration_avg = (corroboration_sum / report_count_nearby) if report_count_nearby > 0 else 0.0
        night_ratio = (night_reports / report_count_nearby) if report_count_nearby > 0 else 0.0
        
        cell_features.append({
            "cell_id": cell["cell_id"],
            "kde_score": kde_score,
            "avg_severity": avg_severity,
            "corroboration_avg": corroboration_avg,
            "night_ratio": night_ratio,
            "report_count": report_count_nearby,
            "most_recent_age_days": min_age_days,
            "category_breakdown": category_counts
        })
        
    df_feats = pd.DataFrame(cell_features)
    
    # Labeling thresholds (trained on features)
    def assign_heuristic_label(row):
        score = row["kde_score"]
        sev = row["avg_severity"]
        if score < 0.15:
            return 0  # low
        elif score > 1.2 or (score > 0.6 and sev >= 3.5):
            return 2  # high
        else:
            return 1  # medium
            
    df_feats["label"] = df_feats.apply(assign_heuristic_label, axis=1)
    
    X = df_feats[["kde_score", "avg_severity", "corroboration_avg", "night_ratio"]].values
    y = df_feats["label"].values
    
    rf = RandomForestClassifier(n_estimators=50, max_depth=5, random_state=42)
    rf.fit(X, y)
    
    preds = rf.predict(X)
    probs = rf.predict_proba(X)
    
    tier_map = {0: "low", 1: "medium", 2: "high"}
    
    scored_cells = []
    for idx, cell in enumerate(cells):
        feat = cell_features[idx]
        pred_label = preds[idx]
        
        raw_kde = feat["kde_score"]
        norm_kde = min(1.0, raw_kde / 3.0)
        prob_high_med = probs[idx][1] + probs[idx][2] if len(probs[idx]) > 2 else (probs[idx][1] if len(probs[idx]) > 1 else 0.0)
        risk_score_val = round(0.4 * norm_kde + 0.6 * prob_high_med, 3)
        
        scored_cells.append({
            "cell_id": cell["cell_id"],
            "lat_min": cell["lat_min"],
            "lat_max": cell["lat_max"],
            "lng_min": cell["lng_min"],
            "lng_max": cell["lng_max"],
            "lat_mid": cell["lat_mid"],
            "lng_mid": cell["lng_mid"],
            "risk_score": risk_score_val,
            "risk_tier": tier_map[pred_label],
            "report_count": feat["report_count"],
            "avg_severity": round(feat["avg_severity"], 2),
            "corroboration_avg": round(feat["corroboration_avg"], 2),
            "most_recent_age_days": round(feat["most_recent_age_days"], 2),
            "category_breakdown": feat["category_breakdown"]
        })
        
    return scored_cells, rf
