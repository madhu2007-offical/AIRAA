import sqlite3
import os
import pymongo
from bson import ObjectId
from typing import List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "airaa.db")
MONGO_URI = os.getenv("MONGO_URI")

# MongoDB connection setup
mongo_client = None
mongo_db = None
mongo_collection = None

if MONGO_URI:
    try:
        mongo_client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        # Trigger connection verify
        mongo_client.server_info()
        mongo_db = mongo_client.get_database("airaa")
        mongo_collection = mongo_db.get_collection("reports")
        print("Connected to MongoDB successfully.")
    except Exception as e:
        print(f"MongoDB connection failed: {e}. Falling back to SQLite.")
        mongo_client = None
        mongo_db = None
        mongo_collection = None

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    if mongo_collection is not None:
        try:
            mongo_collection.create_index([("timestamp", -1)])
            mongo_collection.create_index([("status", 1)])
            print("MongoDB indexes created/verified.")
        except Exception as e:
            print(f"MongoDB index error: {e}")
    else:
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
            method TEXT,
            status TEXT DEFAULT 'approved'
        )
        """)
        
        # Migration: check if status column exists
        cursor.execute("PRAGMA table_info(reports)")
        columns = [col[1] for col in cursor.fetchall()]
        if "status" not in columns:
            try:
                cursor.execute("ALTER TABLE reports ADD COLUMN status TEXT DEFAULT 'approved'")
            except Exception as e:
                print(f"Migration error: {e}")
                
        conn.commit()
        conn.close()

def insert_report(report: Dict[str, Any]) -> Any:
    report_copy = report.copy()
    if "status" not in report_copy:
        report_copy["status"] = "approved"
        
    if mongo_collection is not None:
        result = mongo_collection.insert_one(report_copy)
        return str(result.inserted_id)
    else:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO reports (
            category, description, latitude, longitude, severity, 
            severity_ml, category_ml, sentiment, timestamp, method, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            report_copy["category"],
            report_copy["description"],
            report_copy["latitude"],
            report_copy["longitude"],
            report_copy["severity"],
            report_copy.get("severity_ml"),
            report_copy.get("category_ml"),
            report_copy.get("sentiment"),
            report_copy["timestamp"],
            report_copy.get("method"),
            report_copy["status"]
        ))
        report_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return report_id

def get_all_reports(status: str = "approved") -> List[Dict[str, Any]]:
    if mongo_collection is not None:
        query = {} if status == "all" else {"status": status}
        cursor = mongo_collection.find(query).sort("timestamp", -1)
        results = []
        for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            results.append(doc)
        return results
    else:
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

def approve_report(report_id: Any):
    if mongo_collection is not None:
        try:
            query_id = ObjectId(report_id) if ObjectId.is_valid(report_id) else report_id
        except Exception:
            query_id = report_id
        mongo_collection.update_one({"_id": query_id}, {"$set": {"status": "approved"}})
    else:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE reports SET status = 'approved' WHERE id = ?", (int(report_id),))
        conn.commit()
        conn.close()

def reject_report(report_id: Any):
    if mongo_collection is not None:
        try:
            query_id = ObjectId(report_id) if ObjectId.is_valid(report_id) else report_id
        except Exception:
            query_id = report_id
        mongo_collection.delete_one({"_id": query_id})
    else:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM reports WHERE id = ?", (int(report_id),))
        conn.commit()
        conn.close()
