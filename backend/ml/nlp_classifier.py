import os
import json
import logging
import random
from typing import Dict, Any, Tuple
import google.generativeai as genai
from dotenv import load_dotenv

# Machine Learning Imports
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.tree import DecisionTreeClassifier
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

load_dotenv()
logger = logging.getLogger(__name__)

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    HAS_GEMINI = True
else:
    HAS_GEMINI = False
   
VALID_CATEGORIES = ["harassment", "stalking", "poor lighting", "unsafe infrastructure", "assault", "other"]

# Labeled templates for synthetic dataset expansion & classical ML training
TEMPLATES = {
    "poor lighting": [
        "The streetlights near the park are completely broken, making it pitch black at night.",
        "Extremely dark alleyway behind the market, no working lights for the last two weeks.",
        "Street lamp blinking and then going off, felt very unsafe walking home from the metro.",
        "No lighting on the main footpath. Had to use my phone flashlight to see the road.",
        "Completely dark underpass, very scary to cross alone after 8 PM.",
        "The street lamps are not working here, it is completely dark and isolated.",
        "Defective lighting on the road makes it hard to see and feels unsafe.",
        "No lights on this street, pitch black after sunset."
    ],
    "harassment": [
        "A group of men were catcalling and passing comments near the metro exit.",
        "Verbal harassment by a group standing near the tea stall. They follow you with their eyes.",
        "Felt unsafe as some bike riders were slowing down and shouting inappropriate words.",
        "Group of guys drinking on the roadside and passing vulgar remarks.",
        "Constant staring and whispering by vendors near the alleyway. Felt highly uncomfortable.",
        "Some boys were passing offensive comments and laughing at women walking by.",
        "Verbal abuse by strangers on the corner, felt threatened.",
        "Men gathering near the bus stop catcalling passengers."
    ],
    "stalking": [
        "A suspicious man was following me from the metro station all the way to my apartment gate.",
        "Felt like someone was trailing me inside the park lane, had to speed up my pace.",
        "A slow-moving car was tailing me along the main road, matching my speed.",
        "Followed by an unknown person for over 200 meters. Kept looking back in panic.",
        "A guy followed me into the dark alley and only turned away when I entered a building with security.",
        "Felt someone chasing me down the street, had to run into a local shop for safety.",
        "Suspicious person following me closely for the last ten minutes.",
        "A biker was slowly tracking me as I walked down the bypass road."
    ],
    "unsafe infrastructure": [
        "No CCTV cameras and the footpath is blocked by construction debris, forcing pedestrians onto the road.",
        "Broken pedestrian path, very narrow and surrounded by high bushes that block visibility.",
        "Underpass has no guards or working lights, completely isolated and littered.",
        "Footpath has open manholes and no barrier, making it very risky to walk at night.",
        "The pedestrian bridge is shaky, has no lights, and is occupied by anti-social elements.",
        "Footpath is entirely broken, forcing us to walk on the busy highway road.",
        "No surveillance cameras or security guards in this deserted parking zone.",
        "Pedestrian walkway blocked by scrap material and overgrown trees, zero visibility."
    ],
    "assault": [
        "A person tried to grab my bag and pull me into a dark corner, but I ran away.",
        "An attempted physical attack near the bus stop. Stay away from this spot at night.",
        "A man tried to block my way and grab my arm. Had to scream for help to scare him off.",
        "Was shoved by a passerby who tried to snatch my phone in the dark alley.",
        "Physical confrontation near the park gate, someone tried to restrain me but bystanders intervened.",
        "An attempted physical assault in the underpass, someone tried to hold my hand.",
        "A stranger tried to pull me towards an auto, but I screamed and managed to escape.",
        "Physical attack by a loiterer, got hit on the arm but ran to safety."
    ],
    "other": [
        "A pack of aggressive stray dogs chasing pedestrians near the street corner.",
        "Isolated area with no security presence or police patrolling. Feels abandoned.",
        "Heavy loitering by drunk people near the wine shop. Very unsafe environment.",
        "No security guards at the residential colony gates, anyone can walk in.",
        "Suspicious activities noticed in the abandoned building nearby.",
        "Group of rowdy teenagers blocking the passage and drinking alcohol.",
        "Isolated shortcut road with zero police patrolling, feels very suspicious.",
        "Stray animals blocking the road, making it difficult for pedestrians to cross."
    ]
}

# Global models and metrics cache
_category_pipeline = None
_severity_pipeline = None
_evaluation_metrics = {}

def expand_training_data() -> Tuple[list, list, list]:
    """
    Expands the basic templates with random filler words to create a synthetic 
    dataset of ~240 samples for training and evaluating the classical ML fallback.
    """
    texts = []
    cat_labels = []
    sev_labels = []
    
    fillers_start = ["", "Yesterday, ", "At night, ", "Felt unsafe because ", "Avoid this area: ", "Warning: "]
    fillers_end = ["", " near the corner.", " at night.", " and feels very unsafe.", " near the IT park.", " on my way home."]
    
    # Severity lookup for templates
    sev_map = {
        "assault": 5,
        "stalking": 4,
        "harassment": 3,
        "poor lighting": 2,
        "unsafe infrastructure": 2,
        "other": 2
    }
    
    for category, sentences in TEMPLATES.items():
        base_sev = sev_map[category]
        for sentence in sentences:
            # Create variations
            for fs in fillers_start:
                for fe in fillers_end:
                    # Introduce slight randomization
                    text = f"{fs}{sentence}{fe}"
                    # Severity jitter (±1, clamped 1-5)
                    sev = max(1, min(5, base_sev + random.choice([-1, 0, 1]) if category != "assault" else base_sev))
                    
                    texts.append(text)
                    cat_labels.append(category)
                    sev_labels.append(sev)
                    
    return texts, cat_labels, sev_labels

def init_classical_ml_models():
    """
    Trains TF-IDF + Decision Tree pipelines for category and severity prediction,
    performs a train/test split, and caches performance metrics.
    """
    global _category_pipeline, _severity_pipeline, _evaluation_metrics
    
    logger.info("Initializing classical ML fallback classifiers...")
    texts, cat_labels, sev_labels = expand_training_data()
    
    # 1. Category Classifier
    X_train_cat, X_test_cat, y_train_cat, y_test_cat = train_test_split(
        texts, cat_labels, test_size=0.20, random_state=42, stratify=cat_labels
    )
    
    cat_pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=800, stop_words='english', ngram_range=(1, 2))),
        ('clf', DecisionTreeClassifier(max_depth=12, random_state=42))
    ])
    cat_pipeline.fit(X_train_cat, y_train_cat)
    
    # Evaluate Category
    cat_preds = cat_pipeline.predict(X_test_cat)
    cat_acc = accuracy_score(y_test_cat, cat_preds)
    cat_prec, cat_rec, cat_f1, _ = precision_recall_fscore_support(y_test_cat, cat_preds, average='macro')
    
    # 2. Severity Classifier
    X_train_sev, X_test_sev, y_train_sev, y_test_sev = train_test_split(
        texts, sev_labels, test_size=0.20, random_state=42, stratify=sev_labels
    )
    
    sev_pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=800, stop_words='english', ngram_range=(1, 2))),
        ('clf', DecisionTreeClassifier(max_depth=12, random_state=42))
    ])
    sev_pipeline.fit(X_train_sev, y_train_sev)
    
    # Evaluate Severity
    sev_preds = sev_pipeline.predict(X_test_sev)
    sev_acc = accuracy_score(y_test_sev, sev_preds)
    
    # Save globals
    _category_pipeline = cat_pipeline
    _severity_pipeline = sev_pipeline
    
    _evaluation_metrics = {
        "samples_trained": len(texts),
        "category": {
            "accuracy": round(cat_acc, 3),
            "precision": round(cat_prec, 3),
            "recall": round(cat_rec, 3),
            "f1_score": round(cat_f1, 3)
        },
        "severity": {
            "accuracy": round(sev_acc, 3)
        }
    }
    logger.info(f"Classical ML models trained. F1 category accuracy: {_evaluation_metrics['category']['f1_score']}")

# Trigger training on module import
init_classical_ml_models()

def get_ml_metrics() -> Dict[str, Any]:
    """
    Returns the cached train/test evaluation metrics.
    """
    return _evaluation_metrics

def classify_report_ml(description: str) -> Dict[str, Any]:
    """
    Classifies using the trained offline TF-IDF + Decision Tree models.
    """
    if _category_pipeline is None or _severity_pipeline is None:
        init_classical_ml_models()
        
    try:
        cat_pred = _category_pipeline.predict([description])[0]
        sev_pred = int(_severity_pipeline.predict([description])[0])
        
        return {
            "category_ml": cat_pred,
            "severity_ml": sev_pred,
            "sentiment": "negative",
            "method": "classical fallback (Decision Tree)"
        }
    except Exception as e:
        logger.error(f"Classical ML classification failed: {e}")
        # Default safety fallback
        return {
            "category_ml": "other",
            "severity_ml": 3,
            "sentiment": "negative",
            "method": "hardcoded safety default"
        }

def classify_report(description: str, user_severity: int = 3) -> Dict[str, Any]:
    """
    Classifies report via Gemini API, falling back to local Decision Tree model if unconfigured/failed.
    """
    if not HAS_GEMINI:
        return classify_report_ml(description)
        
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = f"""
        Analyze this safety report.
        
        Report Description: "{description}"
        User Severity: {user_severity}
        
        Classify text and return a JSON object with keys:
        - "category_ml": exactly one of {json.dumps(VALID_CATEGORIES)}
        - "severity_ml": integer 1-5
        - "sentiment": "negative" | "neutral" | "positive"
        """
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        result = json.loads(response.text.strip())
        
        if result.get("category_ml") not in VALID_CATEGORIES:
            result["category_ml"] = "other"
            
        try:
            result["severity_ml"] = int(result.get("severity_ml", user_severity))
            result["severity_ml"] = max(1, min(5, result["severity_ml"]))
        except ValueError:
            result["severity_ml"] = user_severity
            
        result["sentiment"] = str(result.get("sentiment", "negative")).lower()
        result["method"] = "gemini-1.5-flash"
        
        return result
    except Exception as e:
        logger.error(f"Gemini failed: {e}. Falling back to Decision Tree.")
        fallback_res = classify_report_ml(description)
        fallback_res["error"] = str(e)
        return fallback_res
