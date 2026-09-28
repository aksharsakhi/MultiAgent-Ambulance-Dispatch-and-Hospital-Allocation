"""
Stochastic Incident Generation & Clinical Triage Model
Module 01: PEAS Formulation & Clinical Triage Model

Formulation:
- Non-homogeneous Poisson Process call arrival stream:
    P(N(t + dt) - N(t) = 1) = lambda(t) * dt
- Emergency Severity Index (ESI) 5-level clinical triage scale:
    * ESI-1 (Resuscitation): Immediate life-saving intervention (< 8 min target)
    * ESI-2 (Emergent): High-risk, rapid evaluation (< 14 min target)
    * ESI-3 (Urgent): Moderate acuity, multiple resources needed (< 30 min target)
    * ESI-4/5 (Less/Non-urgent): Low acuity (< 60 min target)
- Medical Specialty categorization:
    * TRAUMA_SURGERY (Major motor vehicle collisions, penetrating wounds)
    * CARDIAC_CATH_LAB (Acute STEMI myocardial infarction)
    * NEUROSURGERY (Acute ischemic/hemorrhagic stroke)
    * BURN_CARE (Severe thermal/chemical burns)
    * PEDIATRIC_NICU (Neonatal/infant respiratory distress)
    * GENERAL_SURGERY (Appendicitis, acute abdomen)
"""

import random
from enum import IntEnum
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field

class ESILevel(IntEnum):
    RESUSCITATION = 1 # ESI-1
    EMERGENT = 2      # ESI-2
    URGENT = 3        # ESI-3
    LESS_URGENT = 4   # ESI-4
    NON_URGENT = 5    # ESI-5

@dataclass
class EmergencyIncident:
    incident_id: str
    node_id: int
    pos: Tuple[float, float]
    esi_level: ESILevel
    specialty_needed: str
    spawn_time_sec: float
    golden_hour_limit_sec: float

    # Lifecycle state
    status: str = "UNASSIGNED" # UNASSIGNED, IN_AUCTION, DISPATCHED, ON_SCENE, TRANSPORTING, RESOLVED
    assigned_ambulance_id: Optional[str] = None
    assigned_hospital_id: Optional[str] = None

    # Performance Timestamps
    dispatched_time_sec: Optional[float] = None
    on_scene_time_sec: Optional[float] = None
    transport_start_time_sec: Optional[float] = None
    hospital_arrival_time_sec: Optional[float] = None
    hospital_admit_time_sec: Optional[float] = None

    # Key Performance Metrics
    @property
    def response_time_sec(self) -> Optional[float]:
        """Door-to-patient latency: from 911 spawn to ambulance arrival on scene."""
        if self.on_scene_time_sec is not None:
            return self.on_scene_time_sec - self.spawn_time_sec
        return None

    @property
    def offload_delay_sec(self) -> Optional[float]:
        """Ambulance ramping latency at hospital ER."""
        if self.hospital_admit_time_sec is not None and self.hospital_arrival_time_sec is not None:
            return max(0.0, self.hospital_admit_time_sec - self.hospital_arrival_time_sec)
        return None

    @property
    def is_golden_hour_compliant(self) -> bool:
        resp = self.response_time_sec
        if resp is not None:
            return resp <= self.golden_hour_limit_sec
        return False


class IncidentGenerator:
    """
    Poisson call arrival engine and mass casualty scenario synthesizer.
    """

    def __init__(
        self,
        num_nodes: int = 36,
        base_arrival_rate_per_min: float = 0.40,
        peak_multiplier: float = 2.2,
        seed: int = 42
    ):
        self.num_nodes = num_nodes
        self.base_rate = base_arrival_rate_per_min
        self.peak_mult = peak_multiplier
        self.rng = random.Random(seed)
        self.incident_counter = 0

        # ESI Target response times (in seconds)
        self.target_times = {
            ESILevel.RESUSCITATION: 8.0 * 60.0,   # 8 minutes
            ESILevel.EMERGENT: 14.0 * 60.0,      # 14 minutes
            ESILevel.URGENT: 30.0 * 60.0,        # 30 minutes
            ESILevel.LESS_URGENT: 60.0 * 60.0,   # 60 minutes
            ESILevel.NON_URGENT: 120.0 * 60.0    # 120 minutes
        }

        # Specialty pools by ESI level
        self.esi_specialties = {
            ESILevel.RESUSCITATION: ["TRAUMA_SURGERY", "CARDIAC_CATH_LAB", "NEUROSURGERY"],
            ESILevel.EMERGENT: ["CARDIAC_CATH_LAB", "NEUROSURGERY", "TRAUMA_SURGERY", "BURN_CARE"],
            ESILevel.URGENT: ["GENERAL_SURGERY", "PEDIATRIC_NICU"],
            ESILevel.LESS_URGENT: ["GENERAL_SURGERY"],
            ESILevel.NON_URGENT: ["GENERAL_SURGERY"]
        }

    def generate_step_incidents(
        self,
        current_time_sec: float,
        step_duration_sec: float,
        is_peak_hour: bool,
        city_graph
    ) -> List[EmergencyIncident]:
        """
        Generates incidents occurring during this simulation timestep via Poisson distribution.
        """
        rate_per_min = self.base_rate * (self.peak_mult if is_peak_hour else 1.0)
        rate_per_sec = rate_per_min / 60.0
        expected_arrivals = rate_per_sec * step_duration_sec

        # Poisson draws: for small expected_arrivals, P(k >= 1) ~ expected_arrivals
        # We can use Poisson or exponential inter-arrival
        num_arrivals = 0
        p = self.rng.random()
        # Poisson approximation:
        cumulative = 0.0
        prob_k = math_exp = 2.718281828459045 ** (-expected_arrivals)
        cumulative += prob_k
        while p > cumulative and num_arrivals < 5:
            num_arrivals += 1
            prob_k *= expected_arrivals / num_arrivals
            cumulative += prob_k

        incidents = []
        for _ in range(num_arrivals):
            incidents.append(self._create_single_incident(current_time_sec, city_graph))
        return incidents

    def spawn_mci_cluster(
        self,
        center_node: int,
        casualty_count: int,
        current_time_sec: float,
        city_graph
    ) -> List[EmergencyIncident]:
        """
        Generates a Mass Casualty Incident (MCI) with multiple casualties at one location.
        """
        mci_incidents = []
        for i in range(casualty_count):
            self.incident_counter += 1
            # MCI has higher concentration of severe ESI-1 and ESI-2 casualties
            esi = self.rng.choices(
                [ESILevel.RESUSCITATION, ESILevel.EMERGENT, ESILevel.URGENT],
                weights=[0.40, 0.45, 0.15]
            )[0]
            spec = self.rng.choice(self.esi_specialties[esi])
            pos = city_graph.get_node_pos(center_node)

            inc = EmergencyIncident(
                incident_id=f"MCI-{self.incident_counter:04d}",
                node_id=center_node,
                pos=pos,
                esi_level=esi,
                specialty_needed=spec,
                spawn_time_sec=current_time_sec + i * 15.0, # staggered calls
                golden_hour_limit_sec=self.target_times[esi]
            )
            mci_incidents.append(inc)
        return mci_incidents

    def _create_single_incident(self, current_time_sec: float, city_graph) -> EmergencyIncident:
        self.incident_counter += 1

        # Select random node (avoiding hospital nodes if desired, or uniform)
        node_id = self.rng.randint(0, self.num_nodes - 1)
        pos = city_graph.get_node_pos(node_id)

        # Sample ESI level based on standard epidemiological distribution
        esi = self.rng.choices(
            [ESILevel.RESUSCITATION, ESILevel.EMERGENT, ESILevel.URGENT, ESILevel.LESS_URGENT, ESILevel.NON_URGENT],
            weights=[0.15, 0.35, 0.30, 0.15, 0.05]
        )[0]

        specialty = self.rng.choice(self.esi_specialties[esi])
        target_sec = self.target_times[esi]

        return EmergencyIncident(
            incident_id=f"INC-{self.incident_counter:04d}",
            node_id=node_id,
            pos=pos,
            esi_level=esi,
            specialty_needed=specialty,
            spawn_time_sec=current_time_sec,
            golden_hour_limit_sec=target_sec
        )
