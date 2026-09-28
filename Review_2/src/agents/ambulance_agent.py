"""
Autonomous Heterogeneous Ambulance Agent (BDI Architecture)
Module 01: PEAS Formulation (Ambulance Fleet) & Algorithmic Search

Agent Typology:
- Heterogeneous fleet: Advanced Life Support (ALS), Basic Life Support (BLS),
  Neonatal Intensive Care (NICU), and Helicopter EMS (HEMS).
- Internal BDI Architecture:
    * Beliefs: Current location, fuel level, medical equipment, traffic graph state.
    * Desires: Minimize response time, achieve clinical specialty match, avoid bottlenecks.
    * Intentions: Contract commitment, active path execution, dynamic replanning via D* Lite.
- Navigation Engine:
    * Time-Dependent A* for initial time-optimal path calculation.
    * D* Lite for incremental dynamic rerouting upon encountering traffic gridlock/blockages.
"""

import math
from typing import Dict, List, Set, Tuple, Optional, Any
import mesa
from .messages import ACLMessage, ACLPerformative
from ..algorithms.time_dependent_astar import TimeDependentAStar
from ..algorithms.d_star_lite import DStarLite

class AmbulanceAgent(mesa.Agent):
    """
    Autonomous Ambulance Agent participating in CNP bidding, routing, and patient transport.
    """

    def __init__(
        self,
        unique_id: str,
        model,
        vehicle_type: str,
        base_node: int,
        speed_kmh: float,
        fuel_capacity_km: float,
        capabilities: List[str],
        ignores_road_congestion: bool = False
    ):
        super().__init__(model)
        self.agent_id = unique_id
        self.vehicle_type = vehicle_type
        self.base_node = base_node
        self.current_node = base_node
        self.current_pos = model.city_graph.get_node_pos(base_node)
        self.base_speed_kmh = speed_kmh
        self.fuel_capacity_km = fuel_capacity_km
        self.remaining_fuel_km = fuel_capacity_km
        self.capabilities = set(capabilities)
        self.is_hems = ignores_road_congestion

        # BDI State Machine
        # IDLE, EN_ROUTE_SCENE, ON_SCENE, EN_ROUTE_HOSPITAL, AT_HOSPITAL, RETURNING
        self.state = "IDLE"
        self.active_incident = None
        self.assigned_hospital_id: Optional[str] = None

        # Navigation State
        self.tda_planner = TimeDependentAStar(model.city_graph.graph)
        self.dstar_planner = DStarLite(model.city_graph.graph)
        self.current_path: List[int] = []
        self.target_node: Optional[int] = None
        self.distance_traveled_current_edge_m: float = 0.0

        # Communication
        self.inbox: List[ACLMessage] = []

        # Telemetry Metrics
        self.total_incidents_handled = 0
        self.total_distance_km = 0.0
        self.total_dynamic_replans = 0

    def receive_message(self, msg: ACLMessage):
        self.inbox.append(msg)

    def step(self):
        # 1. Process Inbox Messages (FIPA-ACL)
        while self.inbox:
            msg = self.inbox.pop(0)
            self._handle_message(msg)

        # 2. Execute Motion / Clinical Actions
        self._execute_behavior()

    def _handle_message(self, msg: ACLMessage):
        if msg.performative == ACLPerformative.CFP:
            self._process_cfp(msg)
        elif msg.performative == ACLPerformative.ACCEPT_PROPOSAL:
            self._process_award(msg)
        elif msg.performative == ACLPerformative.REJECT_PROPOSAL:
            # Bid was not accepted, remain in current state
            pass

    def _process_cfp(self, msg: ACLMessage):
        """Evaluates an incident CFP and submits a bid (PROPOSE) or declines (REFUSE)."""
        if self.state != "IDLE":
            # Vehicle already committed to another mission
            refuse_msg = ACLMessage(
                performative=ACLPerformative.REFUSE,
                sender=self.agent_id,
                receiver=msg.sender,
                conversation_id=msg.conversation_id,
                content={"reason": "BUSY", "current_state": self.state}
            )
            self.model.message_bus.send_direct(refuse_msg)
            return

        incident_node = msg.content["node_id"]
        specialty_needed = msg.content["specialty_needed"]
        esi_level = msg.content["esi_level"]

        # 1. Calculate ETA using Time-Dependent A*
        path_res = self.tda_planner.find_shortest_time_path(
            start_node=self.current_node,
            goal_node=incident_node,
            departure_time_sec=self.model.current_time_sec,
            speed_evaluator=None if self.is_hems else self.model.city_graph.get_edge_speed_mps
        )

        eta_sec = path_res.travel_time_sec if path_res else 9999.0
        if self.is_hems:
            # Helicopter flies direct line at high speed
            pos_amb = self.current_pos
            pos_inc = msg.content["pos"]
            dist_m = math.hypot(pos_amb[0] - pos_inc[0], pos_amb[1] - pos_inc[1])
            eta_sec = dist_m / ((self.base_speed_kmh * 1000.0) / 3600.0)

        # 2. Calculate Capability Match Penalty
        capability_penalty = 0.0
        if esi_level == 1 and self.vehicle_type == "BLS":
            capability_penalty = 5.0 # Severe penalty: BLS cannot handle cardiac arrest or intubation
        elif specialty_needed == "PEDIATRIC_NICU" and self.vehicle_type != "NICU":
            capability_penalty = 4.0 # Needs specialized incubator
        elif self.vehicle_type == "ALS":
            capability_penalty = 0.0 # Full advanced capability

        # 3. Submit Bid (PROPOSE)
        propose_msg = ACLMessage(
            performative=ACLPerformative.PROPOSE,
            sender=self.agent_id,
            receiver=msg.sender,
            conversation_id=msg.conversation_id,
            content={
                "ambulance_id": self.agent_id,
                "vehicle_type": self.vehicle_type,
                "eta_sec": eta_sec,
                "capability_penalty": capability_penalty,
                "fuel_penalty": max(0.0, 1.0 - (self.remaining_fuel_km / self.fuel_capacity_km))
            }
        )
        self.model.message_bus.send_direct(propose_msg)

    def _process_award(self, msg: ACLMessage):
        """Dispatcher awarded the contract: Ambulance commits intention and starts transit."""
        inc_id = msg.content["incident_id"]
        inc = self.model.get_incident(inc_id)
        if not inc:
            return

        self.state = "EN_ROUTE_SCENE"
        self.active_incident = inc
        self.target_node = inc.node_id

        # Plan initial path
        if not self.is_hems:
            res = self.tda_planner.find_shortest_time_path(
                start_node=self.current_node,
                goal_node=self.target_node,
                departure_time_sec=self.model.current_time_sec,
                speed_evaluator=self.model.city_graph.get_edge_speed_mps
            )
            self.current_path = res.path if res else [self.current_node, self.target_node]
            # Initialize D* Lite for potential dynamic replanning en route
            self.dstar_planner.initialize(self.current_node, self.target_node)
        else:
            self.current_path = [self.current_node, self.target_node]

        self.distance_traveled_current_edge_m = 0.0

    def _execute_behavior(self):
        dt = self.model.time_step_sec

        if self.state == "EN_ROUTE_SCENE":
            reached = self._move_along_path(dt)
            if reached:
                self.state = "ON_SCENE"
                self.total_incidents_handled += 1
                # Notify dispatcher we are on scene
                inform_msg = ACLMessage(
                    performative=ACLPerformative.INFORM,
                    sender=self.agent_id,
                    receiver=self.model.dispatcher.agent_id,
                    conversation_id=f"INCIDENT-{self.active_incident.incident_id}",
                    content={"action": "ON_SCENE", "incident_id": self.active_incident.incident_id}
                )
                self.model.message_bus.send_direct(inform_msg)

        elif self.state == "ON_SCENE":
            # On-scene patient stabilization & bilateral hospital matching (1 step)
            self._stabilize_and_allocate_hospital()

        elif self.state == "EN_ROUTE_HOSPITAL":
            reached = self._move_along_path(dt)
            if reached:
                self.state = "AT_HOSPITAL"
                self.active_incident.hospital_arrival_time_sec = self.model.current_time_sec

        elif self.state == "AT_HOSPITAL":
            # Patient offload & clinical triage transfer
            self._offload_patient_at_hospital()

        elif self.state == "RETURNING":
            reached = self._move_along_path(dt)
            if reached:
                self.state = "IDLE"
                self.active_incident = None
                self.assigned_hospital_id = None

    def _move_along_path(self, dt: float) -> bool:
        """Moves vehicle along current_path. Returns True when destination is reached."""
        if not self.current_path or len(self.current_path) <= 1:
            return True

        u = self.current_path[0]
        v = self.current_path[1]

        # Determine current edge speed
        if self.is_hems:
            speed_mps = (self.base_speed_kmh * 1000.0) / 3600.0
            edge_length_m = math.hypot(
                self.model.city_graph.get_node_pos(u)[0] - self.model.city_graph.get_node_pos(v)[0],
                self.model.city_graph.get_node_pos(u)[1] - self.model.city_graph.get_node_pos(v)[1]
            )
        else:
            edge_data = self.model.city_graph.graph.get_edge_data(u, v, default={})
            edge_length_m = edge_data.get("length_m", 2000.0)
            speed_mps = self.model.city_graph.get_edge_speed_mps(u, v, self.model.current_time_sec)

            # Check if edge is blocked or severely congested: trigger D* Lite replan!
            if edge_data.get("weight", 0.0) > 50000.0 or speed_mps < 3.0:
                self._trigger_dstar_replan(u, v)
                if len(self.current_path) > 1:
                    v = self.current_path[1]
                    edge_data = self.model.city_graph.graph.get_edge_data(u, v, default={})
                    edge_length_m = edge_data.get("length_m", 2000.0)
                    speed_mps = self.model.city_graph.get_edge_speed_mps(u, v, self.model.current_time_sec)

        dist_step_m = speed_mps * dt
        self.distance_traveled_current_edge_m += dist_step_m
        self.total_distance_km += dist_step_m / 1000.0
        self.remaining_fuel_km = max(0.0, self.remaining_fuel_km - (dist_step_m / 1000.0))

        if self.distance_traveled_current_edge_m >= edge_length_m:
            # Arrived at next node v
            self.current_node = v
            self.current_pos = self.model.city_graph.get_node_pos(v)
            self.current_path.pop(0)
            self.distance_traveled_current_edge_m = 0.0

            if len(self.current_path) <= 1:
                return True # Reached final target
        else:
            # Interpolate position between u and v
            frac = min(1.0, self.distance_traveled_current_edge_m / max(1.0, edge_length_m))
            pos_u = self.model.city_graph.get_node_pos(u)
            pos_v = self.model.city_graph.get_node_pos(v)
            self.current_pos = (
                pos_u[0] + frac * (pos_v[0] - pos_u[0]),
                pos_u[1] + frac * (pos_v[1] - pos_u[1])
            )

        return False

    def _trigger_dstar_replan(self, u: int, v: int):
        """Activates D* Lite incremental replanning when dynamic traffic bottleneck occurs."""
        self.total_dynamic_replans += 1
        replan_res = self.dstar_planner.update_edge_cost(u, v, new_cost_sec=100000.0)
        if replan_res and replan_res.path:
            self.current_path = replan_res.path

    def _stabilize_and_allocate_hospital(self):
        """Allocates patient to an emergency hospital using Gale-Shapley matching."""
        # Request Gale-Shapley matching from simulation model
        hosp = self.model.match_patient_to_hospital(self.active_incident, self)
        self.assigned_hospital_id = hosp.hospital_id
        self.active_incident.assigned_hospital_id = hosp.hospital_id
        self.active_incident.status = "TRANSPORTING"
        self.active_incident.transport_start_time_sec = self.model.current_time_sec

        self.state = "EN_ROUTE_HOSPITAL"
        self.target_node = hosp.node_id

        # Route to assigned hospital
        if not self.is_hems:
            res = self.tda_planner.find_shortest_time_path(
                start_node=self.current_node,
                goal_node=self.target_node,
                departure_time_sec=self.model.current_time_sec,
                speed_evaluator=self.model.city_graph.get_edge_speed_mps
            )
            self.current_path = res.path if res else [self.current_node, self.target_node]
            self.dstar_planner.initialize(self.current_node, self.target_node)
        else:
            self.current_path = [self.current_node, self.target_node]

        self.distance_traveled_current_edge_m = 0.0

    def _offload_patient_at_hospital(self):
        """Patient offload and handover to hospital trauma / ER team."""
        hosp = self.model.get_hospital(self.assigned_hospital_id)
        if hosp:
            # Transfer patient into hospital ER bay
            hosp.admit_patient(self.active_incident)

        # Notify dispatcher
        inform_msg = ACLMessage(
            performative=ACLPerformative.INFORM,
            sender=self.agent_id,
            receiver=self.model.dispatcher.agent_id,
            conversation_id=f"INCIDENT-{self.active_incident.incident_id}",
            content={"action": "DELIVERED", "incident_id": self.active_incident.incident_id}
        )
        self.model.message_bus.send_direct(inform_msg)

        # Return to base station
        self.state = "RETURNING"
        self.target_node = self.base_node

        if not self.is_hems:
            res = self.tda_planner.find_shortest_time_path(
                start_node=self.current_node,
                goal_node=self.base_node,
                departure_time_sec=self.model.current_time_sec,
                speed_evaluator=self.model.city_graph.get_edge_speed_mps
            )
            self.current_path = res.path if res else [self.current_node, self.base_node]
        else:
            self.current_path = [self.current_node, self.base_node]

        self.distance_traveled_current_edge_m = 0.0
