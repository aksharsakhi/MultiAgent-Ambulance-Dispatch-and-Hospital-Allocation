"""
AURA-EMS Mesa Multi-Agent Simulation Model
Module 02: Multi-Agent Execution & Interaction

Architecture:
- Inherits from mesa.Model.
- Coordinates heterogeneous agents:
    * 1x DispatcherAgent (initiates CNP auctions, monitors SLAs)
    * 6x AmbulanceAgents (ALS, BLS, NICU, HEMS with BDI state machines)
    * 3x HospitalAgents (Level 1, 2, 3 Trauma Centers with dynamic bed quotas)
- Features a high-speed decoupled MessageBus routing FIPA-ACL messages.
- Invokes Gale-Shapley stable matching for real-time patient-to-hospital allocation.
- Enforces time-discretized physics, traffic updates, and Poisson call generation.
"""

from typing import Dict, List, Optional, Any
import mesa
from ..environment.city_graph import CityGraph
from ..environment.incident_generator import IncidentGenerator, EmergencyIncident
from ..agents.messages import ACLMessage
from ..agents.dispatcher_agent import DispatcherAgent
from ..agents.ambulance_agent import AmbulanceAgent
from ..agents.hospital_agent import HospitalAgent
from ..algorithms.gale_shapley_matching import (
    GaleShapleyMatcher, PatientRequest, HospitalResource
)

class MessageBus:
    """Decoupled message broker routing FIPA-ACL messages across the multi-agent system."""

    def __init__(self):
        self.agents: Dict[str, Any] = {}
        self.message_log: List[ACLMessage] = []

    def register(self, agent_id: str, agent):
        self.agents[agent_id] = agent

    def send_direct(self, msg: ACLMessage):
        self.message_log.append(msg)
        target = self.agents.get(msg.receiver)
        if target and hasattr(target, "receive_message"):
            target.receive_message(msg)

    def broadcast(self, msg: ACLMessage, target_group: str = "ambulances"):
        self.message_log.append(msg)
        for aid, agent in self.agents.items():
            if target_group == "ambulances" and isinstance(agent, AmbulanceAgent):
                agent.receive_message(msg)
            elif target_group == "hospitals" and isinstance(agent, HospitalAgent):
                agent.receive_message(msg)
            elif target_group == "all":
                if hasattr(agent, "receive_message"):
                    agent.receive_message(msg)


class AURASimulationModel(mesa.Model):
    """
    Main Multi-Agent System Engine for Autonomous Emergency Medical Logistics.
    """

    def __init__(
        self,
        config: Optional[Dict[str, Any]] = None,
        rows: int = 6,
        cols: int = 6,
        block_spacing_m: float = 2000.0,
        time_step_sec: float = 5.0,
        seed: int = 42
    ):
        super().__init__(rng=seed)
        self.time_step_sec = time_step_sec
        self.current_time_sec = 0.0
        self.step_count = 0
        self.config = config or {}

        # 1. Environment & Graph Topology
        self.city_graph = CityGraph(rows=rows, cols=cols, block_spacing_m=block_spacing_m)
        self.message_bus = MessageBus()

        # 2. Incident Generator
        base_rate = self.config.get("incident_generation", {}).get("base_arrival_rate_per_min", 0.40)
        self.incident_generator = IncidentGenerator(
            num_nodes=self.city_graph.num_nodes,
            base_arrival_rate_per_min=base_rate,
            seed=seed
        )
        self.incidents: Dict[str, EmergencyIncident] = {}
        self.resolved_incidents: List[EmergencyIncident] = []

        # 3. Two-Sided Matching Engine
        self.matching_engine = GaleShapleyMatcher()

        # 4. Instantiate Agents
        self.dispatcher = DispatcherAgent("DISPATCHER-01", self)
        self.message_bus.register(self.dispatcher.agent_id, self.dispatcher)

        self.ambulances: Dict[str, AmbulanceAgent] = {}
        self.hospitals: Dict[str, HospitalAgent] = {}

        self._initialize_agents()

    def _initialize_agents(self):
        fleet_cfg = self.config.get("fleet", {}).get("ambulances", [])
        if not fleet_cfg:
            # Default fleet fallback
            fleet_cfg = [
                {"id": "AMB-ALS-01", "type": "ALS", "base_node": 0, "speed_kmh": 65.0, "fuel_capacity_km": 300.0, "capabilities": ["CARDIAC_MONITOR", "VENTILATOR", "INTUBATION"]},
                {"id": "AMB-ALS-02", "type": "ALS", "base_node": 5, "speed_kmh": 65.0, "fuel_capacity_km": 300.0, "capabilities": ["CARDIAC_MONITOR", "VENTILATOR", "INTUBATION"]},
                {"id": "AMB-BLS-01", "type": "BLS", "base_node": 30, "speed_kmh": 55.0, "fuel_capacity_km": 350.0, "capabilities": ["OXYGEN", "SPLINTING"]},
                {"id": "AMB-BLS-02", "type": "BLS", "base_node": 35, "speed_kmh": 55.0, "fuel_capacity_km": 350.0, "capabilities": ["OXYGEN", "SPLINTING"]},
                {"id": "AMB-NICU-01", "type": "NICU", "base_node": 17, "speed_kmh": 55.0, "fuel_capacity_km": 250.0, "capabilities": ["INCUBATOR", "PEDIATRIC_VENTILATOR"]},
                {"id": "AMB-HELI-01", "type": "HEMS", "base_node": 14, "speed_kmh": 180.0, "fuel_capacity_km": 400.0, "capabilities": ["FLIGHT_PHYSICIAN", "BLOOD_TRANSFUSION"], "ignores_road_congestion": True}
            ]

        for acfg in fleet_cfg:
            amb = AmbulanceAgent(
                unique_id=acfg["id"],
                model=self,
                vehicle_type=acfg["type"],
                base_node=acfg["base_node"],
                speed_kmh=acfg["speed_kmh"],
                fuel_capacity_km=acfg.get("fuel_capacity_km", 300.0),
                capabilities=acfg.get("capabilities", []),
                ignores_road_congestion=acfg.get("ignores_road_congestion", False)
            )
            self.ambulances[amb.agent_id] = amb
            self.message_bus.register(amb.agent_id, amb)

        hosp_cfg = self.config.get("hospitals", [])
        if not hosp_cfg:
            hosp_cfg = [
                {"id": "HOSP-01", "name": "Apollo Metro Medical Center", "node_id": 14, "trauma_level": 1, "er_capacity": 18, "icu_capacity": 10, "specialties": ["NEUROSURGERY", "CARDIAC_CATH_LAB", "TRAUMA_SURGERY"]},
                {"id": "HOSP-02", "name": "St. Jude General Hospital", "node_id": 11, "trauma_level": 2, "er_capacity": 12, "icu_capacity": 6, "specialties": ["CARDIAC_CATH_LAB", "GENERAL_SURGERY"]},
                {"id": "HOSP-03", "name": "Westside Community Healthcare", "node_id": 20, "trauma_level": 3, "er_capacity": 8, "icu_capacity": 3, "specialties": ["GENERAL_SURGERY", "PEDIATRIC_NICU"]}
            ]

        for hcfg in hosp_cfg:
            hosp = HospitalAgent(
                unique_id=hcfg["id"],
                model=self,
                name=hcfg["name"],
                node_id=hcfg["node_id"],
                trauma_level=hcfg["trauma_level"],
                er_capacity=hcfg["er_capacity"],
                icu_capacity=hcfg.get("icu_capacity", 5),
                specialties=hcfg.get("specialties", [])
            )
            self.hospitals[hosp.hospital_id] = hosp
            self.message_bus.register(hosp.hospital_id, hosp)

    def get_incident(self, inc_id: str) -> Optional[EmergencyIncident]:
        return self.incidents.get(inc_id)

    def get_hospital(self, hosp_id: str) -> Optional[HospitalAgent]:
        return self.hospitals.get(hosp_id)

    def match_patient_to_hospital(self, incident: EmergencyIncident, ambulance: AmbulanceAgent) -> HospitalAgent:
        """
        Executes Bilateral Gale-Shapley matching for on-scene patient.
        """
        pat_req = PatientRequest(
            patient_id=incident.incident_id,
            incident_node=incident.node_id,
            esi_level=incident.esi_level.value,
            specialty_needed=incident.specialty_needed,
            pos=incident.pos,
            arrival_time_sec=self.current_time_sec,
            ambulance_id=ambulance.agent_id
        )

        hosp_resources = [
            HospitalResource(
                hospital_id=h.hospital_id,
                name=h.name,
                node_id=h.node_id,
                pos=h.pos,
                trauma_level=h.trauma_level,
                total_er_capacity=h.total_er_capacity,
                current_occupied_beds=h.current_occupied_beds,
                specialties=h.specialties
            )
            for h in self.hospitals.values()
        ]

        match_res = self.matching_engine.match([pat_req], hosp_resources)
        matched_hosp_id = match_res.allocation.get(incident.incident_id)

        if matched_hosp_id and matched_hosp_id in self.hospitals:
            return self.hospitals[matched_hosp_id]

        # Fallback to closest hospital if all quotas full
        return min(
            self.hospitals.values(),
            key=lambda h: (incident.pos[0] - h.pos[0])**2 + (incident.pos[1] - h.pos[1])**2
        )

    def spawn_emergency(self, node_id: int, esi_level: int = 1, specialty: str = "TRAUMA_SURGERY") -> EmergencyIncident:
        """Manually trigger an emergency incident (useful for interactive demos and testing)."""
        inc = self.incident_generator._create_single_incident(self.current_time_sec, self.city_graph)
        inc.node_id = node_id
        inc.pos = self.city_graph.get_node_pos(node_id)
        from ..environment.incident_generator import ESILevel
        inc.esi_level = ESILevel(esi_level)
        inc.specialty_needed = specialty
        self.incidents[inc.incident_id] = inc
        self.dispatcher.announce_incident(inc)
        return inc

    def spawn_mci_event(self, node_id: int, count: int = 8) -> List[EmergencyIncident]:
        """Manually trigger a Mass Casualty Incident (MCI) cluster."""
        mci_calls = self.incident_generator.spawn_mci_cluster(node_id, count, self.current_time_sec, self.city_graph)
        for inc in mci_calls:
            self.incidents[inc.incident_id] = inc
            self.dispatcher.announce_incident(inc)
        return mci_calls

    def step(self):
        """Simulates one discrete timestep (default 5.0 seconds)."""
        self.step_count += 1
        self.current_time_sec += self.time_step_sec

        # 1. Update Traffic Congestion Waves periodically
        if self.step_count % 12 == 0:
            is_peak = (30.0 <= (self.current_time_sec / 60.0) <= 75.0)
            self.city_graph.update_traffic_conditions(self.current_time_sec, peak_hour_active=is_peak)

        # 2. Generate Stochastic Poisson Incidents
        is_peak = (30.0 <= (self.current_time_sec / 60.0) <= 75.0)
        new_incidents = self.incident_generator.generate_step_incidents(
            self.current_time_sec,
            self.time_step_sec,
            is_peak_hour=is_peak,
            city_graph=self.city_graph
        )
        for inc in new_incidents:
            self.incidents[inc.incident_id] = inc
            self.dispatcher.announce_incident(inc)

        # 3. Step Dispatcher Agent
        self.dispatcher.step()

        # 4. Step Ambulance Agents
        for amb in self.ambulances.values():
            amb.step()

        # 5. Step Hospital Agents
        for hosp in self.hospitals.values():
            hosp.step()

        # 6. Archive Resolved Incidents
        resolved_now = [inc for inc in self.incidents.values() if inc.status == "RESOLVED"]
        for inc in resolved_now:
            self.resolved_incidents.append(inc)
            del self.incidents[inc.incident_id]
