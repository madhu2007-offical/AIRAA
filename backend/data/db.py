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
    
    # Create reports table with status column
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
        method TEXT,
        status TEXT DEFAULT 'approved'
    )
    """)
    
    # Migration: check if status column exists in existing database, add if missing
    cursor.execute("PRAGMA table_info(reports)")
    columns = [col[1] for col in cursor.fetchall()]
    if "status" not in columns:
        try:
            cursor.execute("ALTER TABLE reports ADD COLUMN status TEXT DEFAULT 'approved'")
            logger.info("Migrated SQLite schema: added 'status' column.")
        except Exception as e:
            print(f"Migration error: {e}")
            
    conn.commit()
    conn.close()

def insert_report(report: Dict[str, Any]) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    status = report.get("status", "approved")
    cursor.execute("""
    INSERT INTO reports (
        category, description, latitude, longitude, severity, 
        severity_ml, category_ml, sentiment, timestamp, method, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        report.get("method"),
        status
    ))
    report_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return report_id

def get_all_reports(status: str = "approved") -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if status == "all":
        cursor.execute("SELECT * FROM reports ORDER BY timestamp DESC")
    else:
        cursor.execute("SELECT * FROM reports WHERE status = ? ORDER BY timestamp DESC", (status,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_pending_reports() -> List[Dict[str, Any]]:
    return get_all_reports(status="pending")

def approve_report(report_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE reports SET status = 'approved' WHERE id = ?", (report_id,))
    conn.commit()
    conn.close()

def reject_report(report_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM reports WHERE id = ?", (report_id,))
    conn.commit()
    conn.close()
