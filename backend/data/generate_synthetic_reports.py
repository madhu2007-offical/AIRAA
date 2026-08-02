import os
import random
import datetime
import math
from faker import Faker
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.db import init_db, insert_report
from ml.nlp_classifier import classify_report_ml

fake = Faker()

# Bounding box for Chennai OMR & Taramani
BBOX = {
    "south": 12.960,
    "west": 80.220,
    "north": 12.995,
    "east": 80.265
}

# Hotspots for spatial clustering in Chennai
HOTSPOTS = [
    {"name": "Taramani MRTS Station", "lat": 12.9862, "lng": 80.2421, "weight": 0.25},
    {"name": "Tidel Park / OMR Junction", "lat": 12.9892, "lng": 80.2465, "weight": 0.20},
    {"name": "Perungudi Bus Stop / OMR", "lat": 12.9642, "lng": 80.2481, "weight": 0.20},
    {"name": "SRP Tools Junction", "lat": 12.9801, "lng": 80.2452, "weight": 0.15},
    {"name": "Kandanchavadi Bus Stop", "lat": 12.9691, "lng": 80.2475, "weight": 0.10},
    {"name": "VHS Hospital Link Road", "lat": 12.9928, "lng": 80.2442, "weight": 0.10}
]

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
    std_dev = 0.0020  # ~200 meters spread
    lat = random.gauss(hotspot["lat"], std_dev)
    lng = random.gauss(hotspot["lng"], std_dev)
    
    lat = max(BBOX["south"], min(BBOX["north"], lat))
    lng = max(BBOX["west"], min(BBOX["east"], lng))
    return lat, lng

def generate_random_coordinate() -> tuple:
    lat = random.uniform(BBOX["south"], BBOX["north"])
    lng = random.uniform(BBOX["west"], BBOX["east"])
    return lat, lng

def generate_report(timestamp: datetime.datetime) -> dict:
    categories = ["poor lighting", "harassment", "stalking", "unsafe infrastructure", "assault", "other"]
    weights = [0.30, 0.25, 0.15, 0.15, 0.05, 0.10]
    category = random.choices(categories, weights=weights)[0]
    
    if random.random() < 0.85:
        hotspot = random.choices(HOTSPOTS, weights=[h["weight"] for h in HOTSPOTS])[0]
        lat, lng = generate_coordinate_near_hotspot(hotspot)
    else:
        lat, lng = generate_random_coordinate()
        
    description = random.choice(TEMPLATES[category])
    
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
        
    # Seed reports are pre-classified using local classical model to build F1-scores
    classification = classify_report_ml(description)
    
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
        "method": "classical fallback (seeder)",
        "status": "approved"
    }

def main():
    db_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "airaa.db")
    if os.path.exists(db_file):
        os.remove(db_file)
        print(f"Removed existing database: {db_file}")
        
    init_db()
    print("Initialized SQLite database with Status support.")
    
    num_reports = 400
    start_date = datetime.datetime.now() - datetime.timedelta(days=30)
    
    print(f"Generating {num_reports} synthetic Chennai reports...")
    
    reports_seeded = 0
    for _ in range(num_reports):
        days_offset = random.uniform(0, 30)
        report_time = start_date + datetime.timedelta(days=days_offset)
        
        if random.random() < 0.70:
            hour = random.choice([18, 19, 20, 21, 22, 23, 0, 1, 2])
            minute = random.randint(0, 59)
            report_time = report_time.replace(hour=hour, minute=minute)
        else:
            hour = random.randint(3, 17)
            minute = random.randint(0, 59)
            report_time = report_time.replace(hour=hour, minute=minute)
            
        report = generate_report(report_time)
        insert_report(report)
        reports_seeded += 1
        
    print(f"Successfully seeded {reports_seeded} reports.")

if __name__ == "__main__":
    main()
