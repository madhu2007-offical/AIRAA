import sqlite3
import os
from typing import List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "airaa.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create reports table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        severity INTEGER NOT NULL,
        severity_ml INTEGER,
        category_ml TEXT,
        sentiment TEXT,
        timestamp TEXT NOT NULL,
        method TEXT
    )
    """)
    
    conn.commit()
    conn.close()

def insert_report(report: Dict[str, Any]) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO reports (
        category, description, latitude, longitude, severity, 
        severity_ml, category_ml, sentiment, timestamp, method
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        report["category"],
        report["description"],
        report["latitude"],
        report["longitude"],
        report["severity"],
        report.get("severity_ml"),
        report.get("category_ml"),
        report.get("sentiment"),
        report["timestamp"],
        report.get("method")
    ))
    report_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return report_id

def get_all_reports() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reports ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
