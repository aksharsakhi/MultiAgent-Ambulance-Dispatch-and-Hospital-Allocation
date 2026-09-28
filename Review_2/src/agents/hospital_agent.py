"""
Emergency Department & Trauma Center Hospital Agent
Module 01: PEAS Formulation (Hospital ER Agent)

Role:
- Manages real-time resuscitation bay, trauma OR, and ICU capacities.
- Participates in Two-Sided Gale-Shapley Stable Matching by publishing open bed quotas
  and clinical specialty capabilities.
- Dynamically tracks ambulance offload delay (ramping queues).
- Discharges treated patients after clinical dwell time, restoring ER capacity.
"""

from typing import Dict, List, Set, Tuple, Optional
import mesa
from .messages import ACLMessage, ACLPerformative
from ..environment.incident_generator import EmergencyIncident

class HospitalAgent(mesa.Agent):
    """
    Autonomous Emergency Department managing bed quotas and clinical triage handover.
    """

    def __init__(
        self,
        unique_id: str,
        model,
        name: str,
        node_id: int,
        trauma_level: int,
        er_capacity: int,
        icu_capacity: int,
        specialties: List[str],
        base_turnaround_min: float = 15.0
    ):
        super().__init__(model)
        self.hospital_id = unique_id
        self.name = name
        self.node_id = node_id
        self.pos = model.city_graph.get_node_pos(node_id)
        self.trauma_level = trauma_level
        self.total_er_capacity = er_capacity
        self.total_icu_capacity = icu_capacity
        self.specialties = set(specialties)
        self.base_turnaround_sec = base_turnaround_min * 60.0

        # Dynamic Patient Registry: list of dicts {incident, admit_time, discharge_time}
        self.admitted_patients: List[Dict] = []
        self.inbox: List[ACLMessage] = []

        # Operational Metrics
        self.total_patients_admitted = 0
        self.total_ramping_delay_sec = 0.0
        self.peak_occupancy = 0

    @property
    def current_occupied_beds(self) -> int:
        return len(self.admitted_patients)

    @property
    def available_beds(self) -> int:
        return max(0, self.total_er_capacity - self.current_occupied_beds)

    @property
    def occupancy_rate(self) -> float:
        return (self.current_occupied_beds / max(1, self.total_er_capacity)) * 100.0

    def receive_message(self, msg: ACLMessage):
        self.inbox.append(msg)

    def admit_patient(self, incident: EmergencyIncident):
        """Ambulance arrives and transfers casualty into an ER resuscitation bay."""
        self.total_patients_admitted += 1
        now = self.model.current_time_sec

        # Calculate clinical dwell time (higher ESI stays longer)
        dwell_min = 20.0 + (5 - incident.esi_level.value) * 15.0
        dwell_sec = dwell_min * 60.0

        # Check if ramping occurs (ambulance waits if zero beds open)
        ramping_sec = 0.0
        if self.available_beds <= 0:
            ramping_sec = 180.0 # 3 min delay waiting for bed turnover
            self.total_ramping_delay_sec += ramping_sec

        incident.hospital_admit_time_sec = now + ramping_sec

        self.admitted_patients.append({
            "incident": incident,
            "admit_time_sec": now,
            "discharge_time_sec": now + dwell_sec
        })

        if len(self.admitted_patients) > self.peak_occupancy:
            self.peak_occupancy = len(self.admitted_patients)

    def step(self):
        # 1. Process Inbox
        while self.inbox:
            _ = self.inbox.pop(0)

        # 2. Discharge Patients who finished emergency care
        now = self.model.current_time_sec
        active_remaining = []
        for p in self.admitted_patients:
            if now < p["discharge_time_sec"]:
                active_remaining.append(p)
        self.admitted_patients = active_remaining
