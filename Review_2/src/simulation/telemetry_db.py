#!/usr/bin/env python3
"""
AURA-EMS SQLite Telemetry Database Engine
Course: 23CSE301 Foundations of Artificial Intelligence · Amrita Vishwa Vidyapeetham

Provides persistent, relational telemetry recording for:
- 911 Emergency Incidents (Lifecycle, Acuity, Triage Latency, Admitting Hospitals)
- FIPA-ACL Communicative Acts (CFP, PROPOSE, ACCEPT_PROPOSAL, REJECT_PROPOSAL, INFORM)
- Time-series Multi-Agent Simulation Performance Metrics
- Real-Time Analytical Aggregations for the Live Web Cockpit
"""

import os
import sqlite3
import threading
from pathlib import Path
from typing import Dict, List, Any, Optional, Union

DB_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DEFAULT_DB_PATH = DB_DIR / "aura_telemetry.db"

class TelemetryDB:
    """Thread-safe SQLite Database Manager for AURA-EMS Telemetry & Mission Analytics."""

    def __init__(self, db_path: Optional[Union[Path, str]] = None):
        self.db_path = Path(db_path) if db_path else DEFAULT_DB_PATH
        self.lock = threading.Lock()
        self._ensure_dir()
        self._init_db()

    def _ensure_dir(self):
        os.makedirs(self.db_path.parent, exist_ok=True)

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self.lock:
            conn = self._get_connection()
            try:
                cur = conn.cursor()
                # Table 1: Emergency Incidents Registry
                cur.execute("""
                CREATE TABLE IF NOT EXISTS incidents (
                    incident_id TEXT PRIMARY KEY,
                    scenario TEXT,
                    node_id INTEGER,
                    pos_x REAL,
                    pos_y REAL,
                    esi_level INTEGER,
                    specialty_needed TEXT,
                    spawn_time_sec REAL,
                    golden_hour_limit_sec REAL,
                    status TEXT,
                    assigned_ambulance_id TEXT,
                    assigned_hospital_id TEXT,
                    dispatched_time_sec REAL,
                    on_scene_time_sec REAL,
                    hospital_admit_time_sec REAL,
                    response_time_sec REAL,
                    offload_delay_sec REAL,
                    golden_hour_met INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)

                # Table 2: FIPA-ACL Communicative Acts
                cur.execute("""
                CREATE TABLE IF NOT EXISTS fipa_telemetry (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    performative TEXT,
                    sender TEXT,
                    receiver TEXT,
                    conversation_id TEXT,
                    summary TEXT,
                    sim_time_sec REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)

                # Table 3: Periodic Simulation Snapshots
                cur.execute("""
                CREATE TABLE IF NOT EXISTS simulation_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    step_count INTEGER,
                    sim_time_sec REAL,
                    scenario TEXT,
                    active_calls INTEGER,
                    resolved_calls INTEGER,
                    mean_response_min REAL,
                    fleet_busy_count INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """)

                # Performance Indices
                cur.execute("CREATE INDEX IF NOT EXISTS idx_inc_status ON incidents (status);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_inc_esi ON incidents (esi_level);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_fipa_time ON fipa_telemetry (sim_time_sec);")
                conn.commit()
            finally:
                conn.close()

    def save_incident(self, inc: Any, scenario: str = "baseline_normal"):
        """Inserts or updates an emergency incident in SQLite."""
        with self.lock:
            conn = self._get_connection()
            try:
                cur = conn.cursor()
                esi_val = inc.esi_level.value if hasattr(inc.esi_level, "value") else int(inc.esi_level)
                resp_sec = inc.response_time_sec if hasattr(inc, "response_time_sec") and inc.response_time_sec is not None else None
                gh_limit = getattr(inc, "golden_hour_limit_sec", 3600.0)
                gh_met = 1 if (resp_sec is not None and resp_sec <= gh_limit) else (0 if resp_sec is not None else None)

                offload_sec = 0.0
                if getattr(inc, "hospital_admit_time_sec", None) and getattr(inc, "hospital_arrival_time_sec", None):
                    offload_sec = max(0.0, inc.hospital_admit_time_sec - inc.hospital_arrival_time_sec)

                cur.execute("""
                INSERT INTO incidents (
                    incident_id, scenario, node_id, pos_x, pos_y, esi_level, specialty_needed,
                    spawn_time_sec, golden_hour_limit_sec, status, assigned_ambulance_id,
                    assigned_hospital_id, dispatched_time_sec, on_scene_time_sec,
                    hospital_admit_time_sec, response_time_sec, offload_delay_sec, golden_hour_met
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(incident_id) DO UPDATE SET
                    status=excluded.status,
                    assigned_ambulance_id=COALESCE(excluded.assigned_ambulance_id, incidents.assigned_ambulance_id),
                    assigned_hospital_id=COALESCE(excluded.assigned_hospital_id, incidents.assigned_hospital_id),
                    dispatched_time_sec=COALESCE(excluded.dispatched_time_sec, incidents.dispatched_time_sec),
                    on_scene_time_sec=COALESCE(excluded.on_scene_time_sec, incidents.on_scene_time_sec),
                    hospital_admit_time_sec=COALESCE(excluded.hospital_admit_time_sec, incidents.hospital_admit_time_sec),
                    response_time_sec=COALESCE(excluded.response_time_sec, incidents.response_time_sec),
                    offload_delay_sec=COALESCE(excluded.offload_delay_sec, incidents.offload_delay_sec),
                    golden_hour_met=COALESCE(excluded.golden_hour_met, incidents.golden_hour_met);
                """, (
                    inc.incident_id, scenario, inc.node_id, inc.pos[0], inc.pos[1],
                    esi_val, getattr(inc, "specialty_needed", "GENERAL_SURGERY"),
                    getattr(inc, "spawn_time_sec", 0.0), gh_limit,
                    getattr(inc, "status", "UNASSIGNED"),
                    getattr(inc, "assigned_ambulance_id", None),
                    getattr(inc, "assigned_hospital_id", None),
                    getattr(inc, "dispatched_time_sec", None),
                    getattr(inc, "on_scene_time_sec", None),
                    getattr(inc, "hospital_admit_time_sec", None),
                    resp_sec, offload_sec, gh_met
                ))
                conn.commit()
            finally:
                conn.close()

    def save_fipa_message(self, performative: str, sender: str, receiver: str, conversation_id: str, summary: str, sim_time_sec: float):
        """Records an asynchronous FIPA-ACL communicative act into SQLite."""
        with self.lock:
            conn = self._get_connection()
            try:
                cur = conn.cursor()
                cur.execute("""
                INSERT INTO fipa_telemetry (performative, sender, receiver, conversation_id, summary, sim_time_sec)
                VALUES (?, ?, ?, ?, ?, ?);
                """, (performative, sender, receiver, conversation_id, summary, sim_time_sec))
                conn.commit()
            finally:
                conn.close()

    def get_all_incidents(self, limit: int = 200) -> List[Dict[str, Any]]:
        """Returns list of incident records from SQLite."""
        with self.lock:
            conn = self._get_connection()
            try:
                cur = conn.cursor()
                cur.execute("""
                SELECT * FROM incidents ORDER BY spawn_time_sec DESC LIMIT ?;
                """, (limit,))
                rows = cur.fetchall()
                return [dict(r) for r in rows]
            finally:
                conn.close()

    def get_analytics_summary(self) -> Dict[str, Any]:
        """Calculates operational intelligence metrics directly from SQLite database."""
        with self.lock:
            conn = self._get_connection()
            try:
                cur = conn.cursor()

                # Basic counts
                cur.execute("SELECT COUNT(*) FROM incidents;")
                total_calls = cur.fetchone()[0]

                cur.execute("SELECT COUNT(*) FROM incidents WHERE status = 'RESOLVED';")
                resolved_calls = cur.fetchone()[0]

                cur.execute("SELECT COUNT(*) FROM incidents WHERE status != 'RESOLVED';")
                active_calls = cur.fetchone()[0]

                # Mean response time (minutes)
                cur.execute("SELECT AVG(response_time_sec) FROM incidents WHERE response_time_sec IS NOT NULL;")
                avg_resp_sec = cur.fetchone()[0]
                mean_resp_min = (avg_resp_sec / 60.0) if avg_resp_sec else 0.0

                # Critical ESI-1 response time
                cur.execute("SELECT AVG(response_time_sec) FROM incidents WHERE esi_level = 1 AND response_time_sec IS NOT NULL;")
                avg_esi1_sec = cur.fetchone()[0]
                esi1_mean_min = (avg_esi1_sec / 60.0) if avg_esi1_sec else 0.0

                # Golden Hour SLA compliance
                cur.execute("SELECT COUNT(*) FROM incidents WHERE golden_hour_met = 1;")
                gh_compliant = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM incidents WHERE golden_hour_met IS NOT NULL;")
                gh_total = cur.fetchone()[0]
                golden_hour_pct = ((gh_compliant / gh_total) * 100.0) if gh_total > 0 else 100.0

                # Mean offload delay (minutes)
                cur.execute("SELECT AVG(offload_delay_sec) FROM incidents WHERE offload_delay_sec IS NOT NULL;")
                avg_offload_sec = cur.fetchone()[0]
                offload_delay_min = (avg_offload_sec / 60.0) if avg_offload_sec else 0.0

                # ESI Acuity Distribution
                esi_dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
                cur.execute("SELECT esi_level, COUNT(*) FROM incidents GROUP BY esi_level;")
                for row in cur.fetchall():
                    if row[0] in esi_dist:
                        esi_dist[row[0]] = row[1]

                # Specialty Distribution
                specialty_dist = {}
                cur.execute("SELECT specialty_needed, COUNT(*) FROM incidents GROUP BY specialty_needed;")
                for row in cur.fetchall():
                    specialty_dist[row[0]] = row[1]

                # Fleet missions handled
                fleet_stats = {}
                cur.execute("""
                SELECT assigned_ambulance_id, COUNT(*) FROM incidents
                WHERE assigned_ambulance_id IS NOT NULL GROUP BY assigned_ambulance_id;
                """)
                for row in cur.fetchall():
                    fleet_stats[row[0]] = row[1]

                # Hospital admission distribution
                hospital_stats = {}
                cur.execute("""
                SELECT assigned_hospital_id, COUNT(*) FROM incidents
                WHERE assigned_hospital_id IS NOT NULL GROUP BY assigned_hospital_id;
                """)
                for row in cur.fetchall():
                    hospital_stats[row[0]] = row[1]

                # Total FIPA Messages
                cur.execute("SELECT COUNT(*) FROM fipa_telemetry;")
                total_fipa_msgs = cur.fetchone()[0]

                # DB File Size
                db_size_kb = 0.0
                if os.path.exists(self.db_path):
                    db_size_kb = round(os.path.getsize(self.db_path) / 1024.0, 1)

                return {
                    "total_incidents": total_calls,
                    "resolved_incidents": resolved_calls,
                    "active_incidents": active_calls,
                    "mean_response_min": round(mean_resp_min, 2),
                    "esi_1_mean_response_min": round(esi1_mean_min, 2),
                    "golden_hour_compliance_pct": round(golden_hour_pct, 1),
                    "mean_offload_delay_min": round(offload_delay_min, 2),
                    "esi_distribution": {f"ESI-{k}": v for k, v in esi_dist.items()},
                    "specialty_distribution": specialty_dist,
                    "fleet_missions": fleet_stats,
                    "hospital_admits": hospital_stats,
                    "total_fipa_messages": total_fipa_msgs,
                    "db_file": str(self.db_path.name),
                    "db_size_kb": db_size_kb
                }
            finally:
                conn.close()

    def clear_db(self):
        """Clears all telemetry records for a clean simulation run."""
        with self.lock:
            conn = self._get_connection()
            try:
                cur = conn.cursor()
                cur.execute("DELETE FROM incidents;")
                cur.execute("DELETE FROM fipa_telemetry;")
                cur.execute("DELETE FROM simulation_snapshots;")
                conn.commit()
            finally:
                conn.close()
