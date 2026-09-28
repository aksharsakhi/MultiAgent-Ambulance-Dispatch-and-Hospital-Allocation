"""
Simulation Metrics Collector & Telemetry Data Engine
Module 04: Code Structure & Scalability & Benchmarks

Metrics Evaluated:
1. Mean Response Time (Door-to-Patient, minutes)
2. ESI-1 Life-Threat Response Time (Target < 8.0 min)
3. Golden Hour Compliance Rate (%)
4. Ambulance Offload Delay (Hospital Ramping Queue, minutes)
5. Clinical Specialty Match Rate (%)
6. Fleet Starvation & Utilization Rate (%)
7. Dynamic D* Lite Replanning Frequency
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import pandas as pd
import numpy as np

@dataclass
class SimulationRunSummary:
    scenario_name: str
    total_calls: int
    resolved_calls: int
    mean_response_time_min: float
    p90_response_time_min: float
    esi_1_mean_response_min: float
    golden_hour_compliance_pct: float
    mean_offload_delay_min: float
    specialty_match_rate_pct: float
    total_dynamic_replans: int
    mean_fleet_utilization_pct: float

class MetricsCollector:
    """Collects real-time telemetry from AURASimulationModel and computes analytical KPIs."""

    def __init__(self, model):
        self.model = model
        self.step_history: List[Dict[str, Any]] = []

    def record_step(self):
        """Snapshots key telemetry metrics at the current timestep."""
        all_incidents = list(self.model.resolved_incidents) + list(self.model.incidents.values())

        # Response times of resolved incidents
        resp_times_min = [
            inc.response_time_sec / 60.0
            for inc in all_incidents
            if inc.response_time_sec is not None
        ]

        # Ramping offload delay
        offload_delays_min = [
            inc.offload_delay_sec / 60.0
            for inc in all_incidents
            if inc.offload_delay_sec is not None
        ]

        # Active ambulance states
        busy_ambs = sum(1 for a in self.model.ambulances.values() if a.state != "IDLE")
        utilization = (busy_ambs / max(1, len(self.model.ambulances))) * 100.0

        snapshot = {
            "time_sec": self.model.current_time_sec,
            "time_min": self.model.current_time_sec / 60.0,
            "total_incidents": len(all_incidents),
            "resolved_incidents": len(self.model.resolved_incidents),
            "active_in_system": len(self.model.incidents),
            "mean_response_min": float(np.mean(resp_times_min)) if resp_times_min else 0.0,
            "mean_offload_min": float(np.mean(offload_delays_min)) if offload_delays_min else 0.0,
            "fleet_utilization_pct": utilization
        }
        self.step_history.append(snapshot)

    def generate_summary(self, scenario_name: str = "AURA-EMS MAS") -> SimulationRunSummary:
        """Calculates aggregate benchmark KPIs across the entire simulation run."""
        all_incidents = list(self.model.resolved_incidents) + list(self.model.incidents.values())

        # Filter incidents where ambulance reached the scene
        attended = [inc for inc in all_incidents if inc.response_time_sec is not None]

        resp_times = [inc.response_time_sec / 60.0 for inc in attended]
        esi_1_resp = [inc.response_time_sec / 60.0 for inc in attended if inc.esi_level.value == 1]
        offload_delays = [inc.offload_delay_sec / 60.0 for inc in attended if inc.offload_delay_sec is not None]

        # Golden hour compliance
        compliant_count = sum(1 for inc in attended if inc.is_golden_hour_compliant)
        compliance_pct = (compliant_count / max(1, len(attended))) * 100.0

        # Specialty match rate
        spec_matches = 0
        allocated = [inc for inc in attended if inc.assigned_hospital_id is not None]
        for inc in allocated:
            hosp = self.model.get_hospital(inc.assigned_hospital_id)
            if hosp and inc.specialty_needed in hosp.specialties:
                spec_matches += 1
        spec_match_pct = (spec_matches / max(1, len(allocated))) * 100.0

        # Total dynamic replans across all ambulances
        total_replans = sum(a.total_dynamic_replans for a in self.model.ambulances.values())

        # Fleet utilization
        utils = [s["fleet_utilization_pct"] for s in self.step_history]
        mean_util = float(np.mean(utils)) if utils else 0.0

        return SimulationRunSummary(
            scenario_name=scenario_name,
            total_calls=len(all_incidents),
            resolved_calls=len(self.model.resolved_incidents),
            mean_response_time_min=float(np.mean(resp_times)) if resp_times else 0.0,
            p90_response_time_min=float(np.percentile(resp_times, 90)) if resp_times else 0.0,
            esi_1_mean_response_min=float(np.mean(esi_1_resp)) if esi_1_resp else 0.0,
            golden_hour_compliance_pct=compliance_pct,
            mean_offload_delay_min=float(np.mean(offload_delays)) if offload_delays else 0.0,
            specialty_match_rate_pct=spec_match_pct,
            total_dynamic_replans=total_replans,
            mean_fleet_utilization_pct=mean_util
        )

    def to_dataframe(self) -> pd.DataFrame:
        """Exports step telemetry into a Pandas DataFrame."""
        return pd.DataFrame(self.step_history)
