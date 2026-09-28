"""
Baseline Model: Centralized Greedy Nearest-Unit CAD System
Module 03: Demo Quality & Empirical Benchmarks

Architecture:
- Represents standard legacy 911 Computer-Aided Dispatch (CAD):
    1. Centralized Greedy Dispatch: Assigns whichever idle ambulance has the lowest Euclidean
       distance to the scene, ignoring clinical capabilities (e.g. sending a BLS to cardiac arrest).
    2. Static Dijkstra Pathfinding: Routes based on static free-flow edge weights, ignoring
       real-time congestion waves, and lacks dynamic D* Lite replanning when roads are jammed.
    3. Greedy Nearest Hospital Dump: Routes patient to the closest hospital without evaluating
       real-time ER bed availability or trauma certification, causing severe ambulance ramping.
"""

import math
from typing import Dict, List, Optional, Any
import networkx as nx
from ..src.environment.city_graph import CityGraph
from ..src.environment.incident_generator import IncidentGenerator, EmergencyIncident

class CentralizedBaselineCAD:
    """
    Simulation of legacy centralized nearest-unit dispatch system.
    """

    def __init__(self, config: Dict[str, Any], seed: int = 42):
        self.config = config
        self.time_step_sec = 5.0
        self.current_time_sec = 0.0
        self.step_count = 0

        self.city_graph = CityGraph(rows=6, cols=6, block_spacing_m=2000.0)
        self.incident_generator = IncidentGenerator(
            num_nodes=self.city_graph.num_nodes,
            base_arrival_rate_per_min=config.get("incident_generation", {}).get("base_arrival_rate_per_min", 0.40),
            seed=seed
        )

        self.ambulances = self._init_ambulances()
        self.hospitals = self._init_hospitals()

        self.incidents: Dict[str, EmergencyIncident] = {}
        self.resolved_incidents: List[EmergencyIncident] = []

    def _init_ambulances(self) -> List[Dict]:
        return [
            {"id": "AMB-01", "node": 0, "pos": self.city_graph.get_node_pos(0), "state": "IDLE", "type": "ALS", "path": []},
            {"id": "AMB-02", "node": 5, "pos": self.city_graph.get_node_pos(5), "state": "IDLE", "type": "ALS", "path": []},
            {"id": "AMB-03", "node": 30, "pos": self.city_graph.get_node_pos(30), "state": "IDLE", "type": "BLS", "path": []},
            {"id": "AMB-04", "node": 35, "pos": self.city_graph.get_node_pos(35), "state": "IDLE", "type": "BLS", "path": []},
            {"id": "AMB-05", "node": 17, "pos": self.city_graph.get_node_pos(17), "state": "IDLE", "type": "NICU", "path": []},
            {"id": "AMB-06", "node": 14, "pos": self.city_graph.get_node_pos(14), "state": "IDLE", "type": "ALS", "path": []}
        ]

    def _init_hospitals(self) -> List[Dict]:
        return [
            {"id": "HOSP-01", "node": 14, "pos": self.city_graph.get_node_pos(14), "capacity": 18, "admitted": []},
            {"id": "HOSP-02", "node": 11, "pos": self.city_graph.get_node_pos(11), "capacity": 12, "admitted": []},
            {"id": "HOSP-03", "node": 20, "pos": self.city_graph.get_node_pos(20), "capacity": 8, "admitted": []}
        ]

    def step(self):
        self.step_count += 1
        self.current_time_sec += self.time_step_sec

        # Update traffic conditions
        if self.step_count % 12 == 0:
            is_peak = (30.0 <= (self.current_time_sec / 60.0) <= 75.0)
            self.city_graph.update_traffic_conditions(self.current_time_sec, peak_hour_active=is_peak)

        # Generate new calls
        is_peak = (30.0 <= (self.current_time_sec / 60.0) <= 75.0)
        new_incidents = self.incident_generator.generate_step_incidents(
            self.current_time_sec, self.time_step_sec, is_peak_hour=is_peak, city_graph=self.city_graph
        )
        for inc in new_incidents:
            self.incidents[inc.incident_id] = inc

        # Centralized Greedy Dispatch: Assign nearest idle ambulance to unassigned incidents
        unassigned = [inc for inc in self.incidents.values() if inc.status == "UNASSIGNED"]
        for inc in unassigned:
            idle_ambs = [a for a in self.ambulances if a["state"] == "IDLE"]
            if not idle_ambs:
                break # All busy

            # Greedy Nearest Vehicle by straight line Euclidean distance
            best_amb = min(
                idle_ambs,
                key=lambda a: (a["pos"][0] - inc.pos[0])**2 + (a["pos"][1] - inc.pos[1])**2
            )

            # Static Dijkstra Pathfinding (ignores dynamic congestion)
            path = nx.shortest_path(self.city_graph.graph, source=best_amb["node"], target=inc.node_id, weight="weight")

            best_amb["state"] = "EN_ROUTE_SCENE"
            best_amb["path"] = list(path)
            best_amb["active_incident"] = inc
            inc.status = "DISPATCHED"
            inc.assigned_ambulance_id = best_amb["id"]
            inc.dispatched_time_sec = self.current_time_sec

        # Step ambulances
        for amb in self.ambulances:
            self._step_ambulance(amb)

        # Step hospital bed discharges
        for hosp in self.hospitals:
            now = self.current_time_sec
            hosp["admitted"] = [p for p in hosp["admitted"] if now < p["discharge_sec"]]

        # Clean resolved
        resolved = [inc for inc in self.incidents.values() if inc.status == "RESOLVED"]
        for inc in resolved:
            self.resolved_incidents.append(inc)
            del self.incidents[inc.incident_id]

    def _step_ambulance(self, amb: Dict):
        dt = self.time_step_sec
        inc = amb.get("active_incident")

        if amb["state"] in ("EN_ROUTE_SCENE", "EN_ROUTE_HOSPITAL", "RETURNING"):
            path = amb["path"]
            if len(path) > 1:
                u, v = path[0], path[1]
                speed_mps = self.city_graph.get_edge_speed_mps(u, v, self.current_time_sec)
                dist_m = speed_mps * dt

                amb["dist_edge"] = amb.get("dist_edge", 0.0) + dist_m
                edge_len = self.city_graph.graph[u][v].get("length_m", 2000.0)

                if amb["dist_edge"] >= edge_len:
                    amb["node"] = v
                    amb["pos"] = self.city_graph.get_node_pos(v)
                    amb["path"].pop(0)
                    amb["dist_edge"] = 0.0

            if len(path) <= 1:
                # Destination reached
                if amb["state"] == "EN_ROUTE_SCENE":
                    amb["state"] = "ON_SCENE"
                    inc.on_scene_time_sec = self.current_time_sec
                    # Immediate greedy nearest hospital selection
                    closest_hosp = min(
                        self.hospitals,
                        key=lambda h: (inc.pos[0] - h["pos"][0])**2 + (inc.pos[1] - h["pos"][1])**2
                    )
                    inc.assigned_hospital_id = closest_hosp["id"]
                    inc.status = "TRANSPORTING"
                    inc.transport_start_time_sec = self.current_time_sec
                    amb["state"] = "EN_ROUTE_HOSPITAL"
                    amb["target_hospital"] = closest_hosp
                    amb["path"] = nx.shortest_path(self.city_graph.graph, source=amb["node"], target=closest_hosp["node"], weight="weight")

                elif amb["state"] == "EN_ROUTE_HOSPITAL":
                    amb["state"] = "AT_HOSPITAL"
                    hosp = amb["target_hospital"]
                    inc.hospital_arrival_time_sec = self.current_time_sec

                    # Greedy nearest dump suffers from offload delay ramping if capacity full!
                    ramping_sec = 0.0
                    if len(hosp["admitted"]) >= hosp["capacity"]:
                        # Severe queuing delay!
                        ramping_sec = 600.0 # 10 min ramping queue delay

                    inc.hospital_admit_time_sec = self.current_time_sec + ramping_sec
                    inc.status = "RESOLVED"

                    dwell_sec = 1800.0
                    hosp["admitted"].append({"incident": inc, "discharge_sec": self.current_time_sec + ramping_sec + dwell_sec})

                    amb["state"] = "RETURNING"
                    amb["path"] = nx.shortest_path(self.city_graph.graph, source=amb["node"], target=0, weight="weight")

                elif amb["state"] == "RETURNING":
                    amb["state"] = "IDLE"
                    amb["active_incident"] = None
                    amb["path"] = []
