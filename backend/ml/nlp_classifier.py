import os
import json
import logging
from typing import Dict, Any
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Configure Gemini if key is present
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    HAS_GEMINI = True
else:
    HAS_GEMINI = False
    logger.warning("GEMINI_API_KEY not found in environment. Using keyword fallback classifier.")

VALID_CATEGORIES = ["harassment", "stalking", "poor lighting", "unsafe infrastructure", "assault", "other"]

def classify_report_fallback(description: str) -> Dict[str, Any]:
    """
    Fallback rule-based classifier using keyword matches.
    """
    desc_lower = description.lower()
    
    # Simple rule-based classification
    category = "other"
    severity = 2
    sentiment = "negative" # default for incident reports
    
    if any(k in desc_lower for k in ["assault", "attack", "beat", "hit", "physical", "grab", "force"]):
        category = "assault"
        severity = 5
    elif any(k in desc_lower for k in ["stalk", "follow", "chase", "trail", "shadow"]):
        category = "stalking"
        severity = 4
    elif any(k in desc_lower for k in ["harass", "tease", "grope", "comment", "catcall", "verbal", "abuse", "shout"]):
        category = "harassment"
        severity = 3
    elif any(k in desc_lower for k in ["light", "dark", "streetlamp", "lamp", "electricity", "shadowy"]):
        category = "poor lighting"
        severity = 2
    elif any(k in desc_lower for k in ["broken", "pothole", "construction", "sidewalk", "pathway", "tunnel", "camera", "cctv"]):
        category = "unsafe infrastructure"
        severity = 2

    return {
        "category_ml": category,
        "severity_ml": severity,
        "sentiment": sentiment,
        "method": "rule-based fallback"
    }

def classify_report(description: str, user_severity: int = 3) -> Dict[str, Any]:
    """
    Classifies a free-text report using Google Gemini or falls back if API key is not configured.
    """
    if not HAS_GEMINI:
        return classify_report_fallback(description)
        
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        prompt = f"""
        Analyze the following incident report for a women's safety mapping application.
        
        Report Description: "{description}"
        User Rated Severity (1-5 scale): {user_severity}
        
        Classify this text and return a JSON object with EXACTLY the following keys:
        - "category_ml": Must be exactly one of: {json.dumps(VALID_CATEGORIES)}
        - "severity_ml": An integer from 1 to 5 indicating the threat/safety severity (1 = minor safety issue like low light, 5 = severe physical threat/assault).
        - "sentiment": A string representing the sentiment ("negative", "neutral", "positive").
        
        Return ONLY valid JSON in your response. No markdown wrappers.
        """
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result = json.loads(response.text.strip())
        
        # Ensure outputs are valid
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
        logger.error(f"Gemini classification failed: {e}. Falling back to rule-based.")
        fallback_res = classify_report_fallback(description)
        fallback_res["error"] = str(e)
        return fallback_res
