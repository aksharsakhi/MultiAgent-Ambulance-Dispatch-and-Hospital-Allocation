"""
Time-Dependent A* (TDA*) Pathfinding Algorithm
Module 03: Algorithmic Modeling & Search Strategy

Mathematical Formulation:
- Graph G = (V, E) where each edge e = (u, v) has a time-dependent traversal cost:
    c(u, v, t) = Length(u, v) / Velocity(u, v, t)
- Departure time t0 at origin node s. Arrival time at neighbor v:
    t_v = t_u + c(u, v, t_u)
- Admissible & Consistent Heuristic:
    h(n) = EuclideanDistance(n, goal) / V_max
    Since V(u, v, t) <= V_max for all edges, h(n) <= h*(n), guaranteeing optimal shortest-time paths.
- Preserves the FIFO (First-In-First-Out) property across road networks.
"""

import math
import heapq
import time
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass
import networkx as nx

@dataclass
class TDAPathResult:
    path: List[int]
    travel_time_sec: float
    departure_time_sec: float
    arrival_time_sec: float
    nodes_expanded: int
    computation_time_ms: float

class TimeDependentAStar:
    """
    Time-Dependent A* algorithm for emergency response routing on dynamic urban graphs.
    """

    def __init__(self, graph: nx.Graph, max_velocity_mps: float = 27.78):
        """
        :param graph: NetworkX graph with node 'pos' (x, y in meters) and edge 'length_m'.
        :param max_velocity_mps: Maximum theoretical vehicle speed (default 100 km/h = 27.78 m/s).
        """
        self.graph = graph
        self.v_max = max(1.0, max_velocity_mps)

    def heuristic(self, node: int, goal: int) -> float:
        """
        Admissible Euclidean heuristic divided by max velocity (yields estimated seconds).
        h(n) = ||pos(n) - pos(goal)||_2 / v_max
        """
        pos_n = self.graph.nodes[node].get("pos", (0.0, 0.0))
        pos_g = self.graph.nodes[goal].get("pos", (0.0, 0.0))
        dist_m = math.hypot(pos_n[0] - pos_g[0], pos_n[1] - pos_g[1])
        return dist_m / self.v_max

    def find_shortest_time_path(
        self,
        start_node: int,
        goal_node: int,
        departure_time_sec: float = 0.0,
        speed_evaluator: Optional[Callable[[int, int, float], float]] = None
    ) -> Optional[TDAPathResult]:
        """
        Computes the time-optimal path from start_node to goal_node.

        :param start_node: Origin intersection node ID.
        :param goal_node: Destination intersection node ID.
        :param departure_time_sec: Simulation clock departure time.
        :param speed_evaluator: Optional callable(u, v, t) returning dynamic speed in m/s.
        :return: TDAPathResult or None if no path exists.
        """
        t_start = time.perf_counter()

        if start_node == goal_node:
            return TDAPathResult(
                path=[start_node],
                travel_time_sec=0.0,
                departure_time_sec=departure_time_sec,
                arrival_time_sec=departure_time_sec,
                nodes_expanded=0,
                computation_time_ms=(time.perf_counter() - t_start) * 1000.0
            )

        # Priority Queue holds tuples: (f_score, g_score, current_node, current_time)
        open_set = []
        heapq.heappush(open_set, (self.heuristic(start_node, goal_node), 0.0, start_node, departure_time_sec))

        came_from: Dict[int, int] = {}
        g_scores: Dict[int, float] = {start_node: 0.0}
        nodes_expanded = 0

        while open_set:
            f, g, current, cur_time = heapq.heappop(open_set)
            nodes_expanded += 1

            if current == goal_node:
                # Reconstruct path
                path = [current]
                while current in came_from:
                    current = came_from[current]
                    path.append(current)
                path.reverse()

                t_comp_ms = (time.perf_counter() - t_start) * 1000.0
                return TDAPathResult(
                    path=path,
                    travel_time_sec=g,
                    departure_time_sec=departure_time_sec,
                    arrival_time_sec=departure_time_sec + g,
                    nodes_expanded=nodes_expanded,
                    computation_time_ms=t_comp_ms
                )

            # Skip if we already found a faster arrival at this node
            if g > g_scores.get(current, float('inf')):
                continue

            for neighbor in self.graph.neighbors(current):
                edge_data = self.graph.get_edge_data(current, neighbor, default={})
                length_m = edge_data.get("length_m", 1000.0)

                # Determine dynamic traversal speed
                if speed_evaluator is not None:
                    speed_mps = speed_evaluator(current, neighbor, cur_time)
                else:
                    speed_kmh = edge_data.get("speed_kmh", 50.0)
                    speed_mps = (speed_kmh * 1000.0) / 3600.0

                speed_mps = max(1.0, speed_mps)
                edge_travel_time = length_m / speed_mps

                tentative_g = g + edge_travel_time
                tentative_time = cur_time + edge_travel_time

                if tentative_g < g_scores.get(neighbor, float('inf')):
                    came_from[neighbor] = current
                    g_scores[neighbor] = tentative_g
                    h_val = self.heuristic(neighbor, goal_node)
                    f_val = tentative_g + h_val
                    heapq.heappush(open_set, (f_val, tentative_g, neighbor, tentative_time))

        return None
