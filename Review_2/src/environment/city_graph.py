"""
Urban Road Network Graph & Dynamic Traffic Congestion Model
Module 02: Environment & Agent Analysis

Formulation:
- Represents an urban road network as a directed/undirected graph G = (V, E).
- Nodes represent road intersections, ambulance stations, and hospital centers.
- Edges represent categorized road segments:
    * Highway: 80 km/h, multi-lane bypass
    * Arterial: 50 km/h, city boulevards
    * Local: 30 km/h, neighborhood connectors
    * Bottleneck Bridge: 40 km/h baseline, highly susceptible to rush-hour gridlock
- Time-Dependent Velocity Function:
    v(e, t) = v_free(e) * [1 - alpha * exp(- (t - t_peak)^2 / (2 * sigma^2))]
"""

import math
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import networkx as nx

@dataclass
class EdgeTrafficState:
    u: int
    v: int
    road_type: str
    length_m: float
    free_flow_speed_kmh: float
    current_speed_kmh: float
    is_blocked: bool = False
    congestion_ratio: float = 1.0 # 1.0 = free flow, 0.25 = severe congestion

class CityGraph:
    """
    City road network model managing topological structure and real-time traffic state.
    """

    def __init__(self, rows: int = 6, cols: int = 6, block_spacing_m: float = 2000.0):
        self.rows = rows
        self.cols = cols
        self.num_nodes = rows * cols
        self.spacing = block_spacing_m

        self.graph = nx.Graph()
        self.edge_states: Dict[Tuple[int, int], EdgeTrafficState] = {}
        self._build_grid_network()

    def _build_grid_network(self):
        # 1. Add intersection nodes with metric (x, y) coordinates
        for r in range(self.rows):
            for c in range(self.cols):
                node_id = r * self.cols + c
                x = c * self.spacing
                y = r * self.spacing
                self.graph.add_node(node_id, pos=(x, y), row=r, col=c)

        # 2. Add edges with realistic road hierarchies
        for r in range(self.rows):
            for c in range(self.cols):
                u = r * self.cols + c

                # Horizontal edge (East)
                if c + 1 < self.cols:
                    v = r * self.cols + (c + 1)
                    road_type, speed = self._classify_road(r, c, is_horizontal=True)
                    self._add_road_edge(u, v, road_type, speed, self.spacing)

                # Vertical edge (North)
                if r + 1 < self.rows:
                    v = (r + 1) * self.cols + c
                    road_type, speed = self._classify_road(r, c, is_horizontal=False)
                    self._add_road_edge(u, v, road_type, speed, self.spacing)

    def _classify_road(self, r: int, c: int, is_horizontal: bool) -> Tuple[str, float]:
        # Outer ring is Highway
        if (r == 0 or r == self.rows - 1) and is_horizontal:
            return "highway", 80.0
        if (c == 0 or c == self.cols - 1) and not is_horizontal:
            return "highway", 80.0

        # Central arterial river bridge bottleneck (between col 2 and 3)
        if c == 2 and is_horizontal and (r == 2 or r == 3):
            return "bridge_bottleneck", 40.0

        # Main cross arteries
        if r == self.rows // 2 or c == self.cols // 2:
            return "arterial", 50.0

        return "local", 30.0

    def _add_road_edge(self, u: int, v: int, road_type: str, speed_kmh: float, length_m: float):
        self.graph.add_edge(
            u, v,
            road_type=road_type,
            speed_kmh=speed_kmh,
            length_m=length_m,
            weight=length_m / ((speed_kmh * 1000.0) / 3600.0)
        )
        state = EdgeTrafficState(
            u=u, v=v,
            road_type=road_type,
            length_m=length_m,
            free_flow_speed_kmh=speed_kmh,
            current_speed_kmh=speed_kmh,
            is_blocked=False,
            congestion_ratio=1.0
        )
        self.edge_states[(u, v)] = state
        self.edge_states[(v, u)] = state

    def update_traffic_conditions(self, current_time_sec: float, peak_hour_active: bool = False):
        """
        Updates dynamic edge traversal speeds according to time-of-day traffic surge.
        """
        time_min = current_time_sec / 60.0

        for (u, v), state in self.edge_states.items():
            if state.is_blocked:
                state.current_speed_kmh = 1.0 # Minimal crawl
                state.congestion_ratio = 0.02
                continue

            base_speed = state.free_flow_speed_kmh

            if state.road_type == "bridge_bottleneck":
                # High sensitivity to rush hour traffic
                if peak_hour_active or (30.0 <= (time_min % 120.0) <= 75.0):
                    # Speed drops to 25% due to bottleneck congestion
                    congestion = 0.25
                else:
                    congestion = 0.85
            elif state.road_type == "arterial":
                if peak_hour_active or (30.0 <= (time_min % 120.0) <= 75.0):
                    congestion = 0.45
                else:
                    congestion = 0.90
            elif state.road_type == "highway":
                congestion = 0.80 if peak_hour_active else 0.98
            else:
                congestion = 0.95

            state.congestion_ratio = congestion
            state.current_speed_kmh = max(5.0, base_speed * congestion)

            # Update NetworkX edge weight (travel time in seconds)
            speed_mps = (state.current_speed_kmh * 1000.0) / 3600.0
            self.graph[u][v]["weight"] = state.length_m / speed_mps
            self.graph[u][v]["speed_kmh"] = state.current_speed_kmh

    def set_road_blockage(self, u: int, v: int, is_blocked: bool = True):
        """Creates or clears a sudden road blockage / accident on edge (u, v)."""
        if (u, v) in self.edge_states:
            self.edge_states[(u, v)].is_blocked = is_blocked
            self.edge_states[(v, u)].is_blocked = is_blocked
            if is_blocked:
                self.graph[u][v]["weight"] = 100000.0 # Effectively impassable
            else:
                speed_mps = (self.edge_states[(u, v)].free_flow_speed_kmh * 1000.0) / 3600.0
                self.graph[u][v]["weight"] = self.edge_states[(u, v)].length_m / speed_mps

    def get_node_pos(self, node: int) -> Tuple[float, float]:
        return self.graph.nodes[node]["pos"]

    def get_edge_speed_mps(self, u: int, v: int, t_sec: float) -> float:
        state = self.edge_states.get((u, v))
        if state is None:
            return 13.89 # Default 50 km/h in m/s
        return max(1.0, (state.current_speed_kmh * 1000.0) / 3600.0)
