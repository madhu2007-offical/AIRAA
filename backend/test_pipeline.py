import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from data.db import get_all_reports
from ml.risk_model import train_and_score_grid
from ml.route_engine import find_routes

def test_pipeline():
    print("=== Testing Database Fetch ===")
    reports = get_all_reports()
    print(f"Retrieved {len(reports)} reports from database.")
    assert len(reports) > 0, "No reports found in the database!"
    
    print("\n=== Testing ML Risk Grid Scoring ===")
    scored_cells, classifier = train_and_score_grid(reports)
    print(f"Scored {len(scored_cells)} grid cells.")
    print(f"Classifier trained successfully: {classifier is not None}")
    
    # Check distribution of risk tiers
    tiers = [c["risk_tier"] for c in scored_cells]
    print(f"Risk tier distribution: Low: {tiers.count('low')}, Medium: {tiers.count('medium')}, High: {tiers.count('high')}")
    
    print("\n=== Testing Routing Engine ===")
    # Green Park Metro Station to Hauz Khas Village
    origin = (28.558, 77.206)
    destination = (28.553, 77.194)
    print(f"Computing paths from {origin} to {destination}...")
    
    routes = find_routes(origin, destination, scored_cells)
    print(f"Generated {len(routes)} route options:")
    for idx, route in enumerate(routes):
        print(f"  Route {idx+1}: {route['name']} ({route['type']})")
        print(f"    Distance: {route['distance_meters']} meters")
        print(f"    Duration: {route['duration_minutes']:.1f} mins")
        print(f"    Average Risk Index: {route['average_risk']:.1f}%")
        print(f"    Coordinates Count: {len(route['coordinates'])}")

if __name__ == "__main__":
    test_pipeline()
