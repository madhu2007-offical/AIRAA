import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from data.db import get_all_reports, get_pending_reports
from ml.risk_model import train_and_score_grid
from ml.route_engine import find_routes, fetch_osm_emergency_features
from ml.nlp_classifier import get_ml_metrics

def test_pipeline():
    print("=== Testing Database Fetch ===")
    reports = get_all_reports()
    print(f"Retrieved {len(reports)} approved reports from database.")
    assert len(reports) > 0, "No reports found in the database!"
    
    print("\n=== Testing Classifier ML Fallback Metrics ===")
    metrics = get_ml_metrics()
    print(f"Trained classical classifier on {metrics['samples_trained']} sentences.")
    print(f"Category F1 Score accuracy: {metrics['category']['f1_score'] * 100:.1f}%")
    print(f"Precision: {metrics['category']['precision'] * 100:.1f}%")
    print(f"Recall: {metrics['category']['recall'] * 100:.1f}%")
    
    print("\n=== Testing ML Risk Grid Scoring ===")
    scored_cells, classifier = train_and_score_grid(reports)
    print(f"Scored {len(scored_cells)} grid cells.")
    print(f"Classifier trained successfully: {classifier is not None}")
    
    tiers = [c["risk_tier"] for c in scored_cells]
    print(f"Risk tier distribution: Low: {tiers.count('low')}, Medium: {tiers.count('medium')}, High: {tiers.count('high')}")
    
    print("\n=== Testing OSM Emergency Feature Query ===")
    emergencies = fetch_osm_emergency_features()
    print(f"Found {len(emergencies)} emergency stations (police/hospitals) in zone.")
    for idx, e in enumerate(emergencies[:3]):
        print(f"  {idx+1}: {e['name']} ({e['type']}) at {e['lat']:.5f}, {e['lng']:.5f}")
        
    print("\n=== Testing Routing Engine ===")
    # Taramani MRTS Station to VHS Hospital
    origin = (12.9862, 80.2421)
    destination = (12.9928, 80.2455)
    print(f"Computing paths from {origin} to {destination}...")
    
    routes = find_routes(origin, destination, scored_cells)
    print(f"Generated {len(routes)} route options:")
    for idx, route in enumerate(routes):
        print(f"  Route {idx+1}: {route['name']} ({route['type']})")
        print(f"    Distance: {route['distance_meters']} meters")
        print(f"    Duration: {route['duration_minutes']:.1f} mins")
        print(f"    Average Risk Index: {route['average_risk']:.1f}%")
        print(f"    Risk Reduction vs Baseline: {route['risk_reduction_pct']}%")
        print(f"    Coordinates Count: {len(route['coordinates'])}")

if __name__ == "__main__":
    test_pipeline()
