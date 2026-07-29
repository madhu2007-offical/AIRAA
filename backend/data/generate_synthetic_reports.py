import os
import random
import datetime
import math
from faker import Faker
from db import init_db, insert_report
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ml.nlp_classifier import classify_report_fallback

fake = Faker()

# Bounding box for Hauz Khas & Safdarjung Enclave
BBOX = {
    "south": 28.535,
    "west": 77.185,
    "north": 28.570,
    "east": 77.225
}

# Hotspots for clustering (transit hubs, markets, parks)
HOTSPOTS = [
    {"name": "Green Park Metro Station", "lat": 28.558, "lng": 77.206, "weight": 0.25},
    {"name": "Hauz Khas Metro Station", "lat": 28.543, "lng": 77.206, "weight": 0.20},
    {"name": "Hauz Khas Village / Deer Park", "lat": 28.553, "lng": 77.194, "weight": 0.20},
    {"name": "Safdarjung Development Area (SDA) Market", "lat": 28.546, "lng": 77.200, "weight": 0.15},
    {"name": "Safdarjung Hospital / Ring Road", "lat": 28.567, "lng": 77.208, "weight": 0.10},
    {"name": "Green Park Main Market", "lat": 28.561, "lng": 77.203, "weight": 0.10}
]

# Report templates for realistic simulated text
TEMPLATES = {
    "poor lighting": [
        "The streetlights near the park are completely broken, making it pitch black at night.",
        "Extremely dark alleyway behind the market, no working lights for the last two weeks.",
        "Street lamp blinking and then going off, felt very unsafe walking home from the metro.",
        "No lighting on the main footpath. Had to use my phone flashlight to see the road.",
        "Completely dark underpass, very scary to cross alone after 8 PM."
    ],
    "harassment": [
        "A group of men were catcalling and passing comments near the metro exit.",
        "Verbal harassment by a group standing near the tea stall. They follow you with their eyes.",
        "Felt unsafe as some bike riders were slowing down and shouting inappropriate words.",
        "Group of guys drinking on the roadside and passing vulgar remarks.",
        "Constant staring and whispering by vendors near the alleyway. Felt highly uncomfortable."
    ],
    "stalking": [
        "A suspicious man was following me from the metro station all the way to my apartment gate.",
        "Felt like someone was trailing me inside the park lane, had to speed up my pace.",
        "A slow-moving car was tailing me along the main road, matching my speed.",
        "Followed by an unknown person for over 200 meters. Kept looking back in panic.",
        "A guy followed me into the dark alley and only turned away when I entered a building with security."
    ],
    "unsafe infrastructure": [
        "No CCTV cameras and the footpath is blocked by construction debris, forcing pedestrians onto the road.",
        "Broken pedestrian path, very narrow and surrounded by high bushes that block visibility.",
        "Underpass has no guards or working lights, completely isolated and littered.",
        "Footpath has open manholes and no barrier, making it very risky to walk at night.",
        "The pedestrian bridge is shaky, has no lights, and is occupied by anti-social elements."
    ],
    "assault": [
        "A person tried to grab my bag and pull me into a dark corner, but I ran away.",
        "An attempted physical attack near the bus stop. Stay away from this spot at night.",
        "A man tried to block my way and grab my arm. Had to scream for help to scare him off.",
        "Was shoved by a passerby who tried to snatch my phone in the dark alley.",
        "Physical confrontation near the park gate, someone tried to restrain me but bystanders intervened."
    ],
    "other": [
        "A pack of aggressive stray dogs chasing pedestrians near the street corner.",
        "Isolated area with no security presence or police patrolling. Feels abandoned.",
        "Heavy loitering by drunk people near the wine shop. Very unsafe environment.",
        "No security guards at the residential colony gates, anyone can walk in.",
        "Suspicious activities noticed in the abandoned building nearby."
    ]
}

def generate_coordinate_near_hotspot(hotspot: dict) -> tuple:
    # Generate coordinates using a normal distribution around the hotspot to create realistic density clusters
    std_dev = 0.0025 # roughly 250 meters spread
    lat = random.gauss(hotspot["lat"], std_dev)
    lng = random.gauss(hotspot["lng"], std_dev)
    
    # Clip to bounding box just in case
    lat = max(BBOX["south"], min(BBOX["north"], lat))
    lng = max(BBOX["west"], min(BBOX["east"], lng))
    return lat, lng

def generate_random_coordinate() -> tuple:
    # Fallback to random uniform coordinate in the bbox
    lat = random.uniform(BBOX["south"], BBOX["north"])
    lng = random.uniform(BBOX["west"], BBOX["east"])
    return lat, lng

def generate_report(timestamp: datetime.datetime) -> dict:
    # Select category based on realistic distribution
    categories = ["poor lighting", "harassment", "stalking", "unsafe infrastructure", "assault", "other"]
    # Assault is rarer, poor lighting and harassment are more common
    weights = [0.30, 0.25, 0.15, 0.15, 0.05, 0.10]
    category = random.choices(categories, weights=weights)[0]
    
    # Generate lat/lng using hotspots (85% cluster, 15% noise)
    if random.random() < 0.85:
        # Choose hotspot based on weights
        hotspot = random.choices(HOTSPOTS, weights=[h["weight"] for h in HOTSPOTS])[0]
        lat, lng = generate_coordinate_near_hotspot(hotspot)
    else:
        lat, lng = generate_random_coordinate()
        
    description = random.choice(TEMPLATES[category])
    
    # User-assigned severity slider (1-5)
    # Give higher severity for assault/stalking, lower for lighting/infrastructure
    if category == "assault":
        severity = random.randint(4, 5)
    elif category == "stalking":
        severity = random.randint(3, 5)
    elif category == "harassment":
        severity = random.randint(2, 4)
    elif category in ["poor lighting", "unsafe infrastructure"]:
        severity = random.randint(1, 3)
    else:
        severity = random.randint(1, 4)
        
    # Classify using fallback rules to write to db immediately
    classification = classify_report_fallback(description)
    
    return {
        "category": category,
        "description": description,
        "latitude": lat,
        "longitude": lng,
        "severity": severity,
        "severity_ml": classification["severity_ml"],
        "category_ml": classification["category_ml"],
        "sentiment": classification["sentiment"],
        "timestamp": timestamp.isoformat(),
        "method": "rule-based fallback (seeder)"
    }

def main():
    # Remove existing database if exists to ensure clean seed
    db_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "airaa.db")
    if os.path.exists(db_file):
        os.remove(db_file)
        print(f"Removed existing database: {db_file}")
        
    init_db()
    print("Initialized SQLite database.")
    
    # Generate 400 reports over the last 30 days
    # Skew timestamps toward evening/night (6 PM to 3 AM)
    num_reports = 400
    start_date = datetime.datetime.now() - datetime.timedelta(days=30)
    
    print(f"Generating {num_reports} synthetic reports for the pilot zone...")
    
    reports_seeded = 0
    for _ in range(num_reports):
        # Pick a random day in the last 30 days
        days_offset = random.uniform(0, 30)
        report_time = start_date + datetime.timedelta(days=days_offset)
        
        # Skew time of day: 70% chance of being between 18:00 and 03:00
        if random.random() < 0.70:
            hour = random.choice([18, 19, 20, 21, 22, 23, 0, 1, 2])
            minute = random.randint(0, 59)
            second = random.randint(0, 59)
            report_time = report_time.replace(hour=hour, minute=minute, second=second)
        else:
            hour = random.randint(3, 17)
            minute = random.randint(0, 59)
            second = random.randint(0, 59)
            report_time = report_time.replace(hour=hour, minute=minute, second=second)
            
        report = generate_report(report_time)
        insert_report(report)
        reports_seeded += 1
        
    print(f"Successfully seeded {reports_seeded} reports.")

if __name__ == "__main__":
    main()
