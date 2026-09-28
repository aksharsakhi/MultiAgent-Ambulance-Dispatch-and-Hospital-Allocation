"""
Bilateral Gale-Shapley Stable Matching Algorithm for Hospital Bed Allocation
Module 03: Algorithmic Modeling & Two-Sided Matching Theory

Mathematical Formulation:
- Two-Sided Market:
    P = {p_1, p_2, ..., p_n} (Set of Emergency Patients requiring admission)
    H = {h_1, h_2, ..., h_m} (Set of Hospitals with quota capacity q_h)
- Patient Preferences:
    Rank hospitals by utility: U_p(h) = w_trauma * TraumaFit(p, h) + w_dist / TravelTime(p, h) + w_beds * OpenBeds(h)
- Hospital Preferences:
    Rank patients by clinical acuity: U_h(p) = w_esi * (6 - ESI_p) + w_spec * SpecialtyMatch(p, h)
- Gale-Shapley Deferred Acceptance Guarantee:
    1. Weak Pareto Optimality for patients.
    2. Elimination of blocking pairs (p, h) where p prefers h over matched hospital,
       and h has capacity or prefers p over an admitted patient.
    3. Eliminates ambulance offload delays (ramping queues) by pre-locking open ER beds.
"""

from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, field
import math

@dataclass
class PatientRequest:
    patient_id: str
    incident_node: int
    esi_level: int              # 1 (Resuscitation) to 5 (Non-urgent)
    specialty_needed: str       # e.g., "TRAUMA_SURGERY", "CARDIAC_CATH_LAB", "NEUROSURGERY"
    pos: Tuple[float, float]
    arrival_time_sec: float
    ambulance_id: str

@dataclass
class HospitalResource:
    hospital_id: str
    name: str
    node_id: int
    pos: Tuple[float, float]
    trauma_level: int           # 1 (Regional Comprehensive), 2 (General Trauma), 3 (Community)
    total_er_capacity: int
    current_occupied_beds: int
    specialties: Set[str] = field(default_factory=set)

    @property
    def available_beds(self) -> int:
        return max(0, self.total_er_capacity - self.current_occupied_beds)

@dataclass
class MatchingResult:
    allocation: Dict[str, str]          # patient_id -> hospital_id
    rejections: List[str]               # Unmatched patient_ids (if total city capacity exceeded)
    hospital_assignments: Dict[str, List[str]] # hospital_id -> list of patient_ids
    blocking_pairs_count: int
    specialty_match_rate: float
    mean_travel_distance_km: float

class GaleShapleyMatcher:
    """
    Two-Sided Matching engine allocating emergency ambulances to optimal hospital ERs.
    """

    def __init__(
        self,
        weight_specialty: float = 0.40,
        weight_distance: float = 0.35,
        weight_availability: float = 0.25
    ):
        self.w_spec = weight_specialty
        self.w_dist = weight_distance
        self.w_avail = weight_availability

    def compute_patient_utility(self, patient: PatientRequest, hospital: HospitalResource) -> float:
        """Utility of hospital h from the perspective of patient p."""
        # Specialty match bonus
        has_spec = 1.0 if patient.specialty_needed in hospital.specialties else 0.0

        # Trauma level alignment (ESI-1 prefers Level 1)
        trauma_score = 0.0
        if patient.esi_level == 1:
            trauma_score = 1.0 if hospital.trauma_level == 1 else (0.5 if hospital.trauma_level == 2 else 0.2)
        elif patient.esi_level == 2:
            trauma_score = 1.0 if hospital.trauma_level in (1, 2) else 0.5
        else:
            trauma_score = 1.0 # ESI 3-5 can be treated at any hospital level

        # Travel distance penalty (Euclidean km)
        dist_km = math.hypot(patient.pos[0] - hospital.pos[0], patient.pos[1] - hospital.pos[1]) / 1000.0
        dist_score = 1.0 / (1.0 + dist_km * 0.1)

        # Bed capacity buffer
        cap_ratio = hospital.available_beds / max(1, hospital.total_er_capacity)

        utility = (
            self.w_spec * (0.6 * has_spec + 0.4 * trauma_score) +
            self.w_dist * dist_score +
            self.w_avail * cap_ratio
        )
        return utility

    def compute_hospital_utility(self, hospital: HospitalResource, patient: PatientRequest) -> float:
        """Priority of patient p from the perspective of hospital h."""
        # Clinical Acuity Priority (ESI-1 gets maximum priority: 5 pts, ESI-5 gets 1 pt)
        acuity_score = (6 - patient.esi_level) / 5.0

        # Clinical Mission Alignment
        has_spec = 1.0 if patient.specialty_needed in hospital.specialties else 0.2

        # Level alignment
        level_fit = 1.0
        if hospital.trauma_level == 1 and patient.esi_level > 3:
            level_fit = 0.4 # Level 1 hospitals prefer high-acuity trauma over simple cuts

        return 0.60 * acuity_score + 0.25 * has_spec + 0.15 * level_fit

    def match(
        self,
        patients: List[PatientRequest],
        hospitals: List[HospitalResource]
    ) -> MatchingResult:
        """
        Executes the Gale-Shapley Bilateral Deferred Acceptance algorithm.
        """
        if not patients or not hospitals:
            return MatchingResult(
                allocation={},
                rejections=[p.patient_id for p in patients],
                hospital_assignments={h.hospital_id: [] for h in hospitals},
                blocking_pairs_count=0,
                specialty_match_rate=0.0,
                mean_travel_distance_km=0.0
            )

        hosp_dict = {h.hospital_id: h for h in hospitals}
        pat_dict = {p.patient_id: p for p in patients}

        # 1. Generate Patient Preference Lists (ranked high to low utility)
        patient_prefs: Dict[str, List[str]] = {}
        for p in patients:
            scored = [(h.hospital_id, self.compute_patient_utility(p, h)) for h in hospitals]
            scored.sort(key=lambda x: x[1], reverse=True)
            patient_prefs[p.patient_id] = [h_id for h_id, _ in scored]

        # 2. Pre-calculate Hospital Preference ranking over patients
        hospital_patient_scores: Dict[str, Dict[str, float]] = {}
        for h in hospitals:
            hospital_patient_scores[h.hospital_id] = {
                p.patient_id: self.compute_hospital_utility(h, p) for p in patients
            }

        # Available quota for allocation in this round
        hospital_quotas = {h.hospital_id: h.available_beds for h in hospitals}

        # Current tentative matches: hospital_id -> list of patient_ids
        held_matches: Dict[str, List[str]] = {h.hospital_id: [] for h in hospitals}
        proposals_made: Dict[str, int] = {p.patient_id: 0} # index in preference list
        unmatched_patients = [p.patient_id for p in patients]

        # 3. Deferred Acceptance Loop
        while unmatched_patients:
            p_id = unmatched_patients.pop(0)
            prefs = patient_prefs[p_id]
            idx = proposals_made.get(p_id, 0)

            if idx >= len(prefs):
                # Patient exhausted all hospital options in the city
                continue

            h_id = prefs[idx]
            proposals_made[p_id] = idx + 1

            current_held = held_matches[h_id]
            quota = hospital_quotas[h_id]

            if len(current_held) < quota:
                # Hospital has open bed, tentatively accept proposal
                current_held.append(p_id)
                held_matches[h_id] = current_held
            else:
                # Hospital is at capacity: check if new patient has higher clinical priority
                # Find patient with lowest priority in current held pool
                current_held.sort(key=lambda x: hospital_patient_scores[h_id][x])
                worst_held = current_held[0]
                worst_score = hospital_patient_scores[h_id][worst_held]
                new_score = hospital_patient_scores[h_id][p_id]

                if new_score > worst_score:
                    # Admit new patient, kick out worst patient
                    current_held.pop(0)
                    current_held.append(p_id)
                    held_matches[h_id] = current_held
                    unmatched_patients.append(worst_held) # Kicked out patient proposes next
                else:
                    # New patient is rejected, continues proposing next round
                    unmatched_patients.append(p_id)

        # 4. Construct Allocation Map & Verify Stability
        allocation: Dict[str, str] = {}
        matched_patients = set()
        for h_id, p_list in held_matches.items():
            for p_id in p_list:
                allocation[p_id] = h_id
                matched_patients.add(p_id)

        rejections = [p.patient_id for p in patients if p.patient_id not in matched_patients]

        # Verify Stability (Checking for Blocking Pairs)
        blocking_pairs = 0
        for p_id, p in pat_dict.items():
            assigned_h = allocation.get(p_id)
            p_util_assigned = self.compute_patient_utility(p, hosp_dict[assigned_h]) if assigned_h else -1.0

            for h in hospitals:
                if h.hospital_id == assigned_h:
                    continue
                # Would patient strictly prefer h?
                if self.compute_patient_utility(p, h) > p_util_assigned:
                    # Does hospital have space, or prefer p over one of its admitted patients?
                    h_admits = held_matches[h.hospital_id]
                    if len(h_admits) < hospital_quotas[h.hospital_id]:
                        blocking_pairs += 1
                    else:
                        worst_admit = min(h_admits, key=lambda x: hospital_patient_scores[h.hospital_id][x])
                        if hospital_patient_scores[h.hospital_id][p_id] > hospital_patient_scores[h.hospital_id][worst_admit]:
                            blocking_pairs += 1

        # Calculate specialty match rate
        specialty_matches = 0
        total_dist_km = 0.0
        for p_id, h_id in allocation.items():
            p = pat_dict[p_id]
            h = hosp_dict[h_id]
            if p.specialty_needed in h.specialties:
                specialty_matches += 1
            dist = math.hypot(p.pos[0] - h.pos[0], p.pos[1] - h.pos[1]) / 1000.0
            total_dist_km += dist

        spec_rate = (specialty_matches / len(allocation)) * 100.0 if allocation else 0.0
        mean_dist = (total_dist_km / len(allocation)) if allocation else 0.0

        return MatchingResult(
            allocation=allocation,
            rejections=rejections,
            hospital_assignments=held_matches,
            blocking_pairs_count=blocking_pairs,
            specialty_match_rate=spec_rate,
            mean_travel_distance_km=mean_dist
        )
