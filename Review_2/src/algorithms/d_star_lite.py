"""
D* Lite Incremental Dynamic Replanning Algorithm
Module 03: Algorithmic Modeling & Search Strategy

Formulation (Koenig & Likhachev, AAAI):
- Designed for mobile agents navigating dynamic, uncertain urban environments with traffic blockages.
- Maintains g(s) and rhs(s) one-step lookahead values:
    rhs(s) = 0 if s == goal else min_{s' in Succ(s)} (c(s, s') + g(s'))
- Consistent state: g(s) == rhs(s). Overconsistent if g(s) > rhs(s). Underconsistent if g(s) < rhs(s).
- Priority Key:
    k(s) = [min(g(s), rhs(s)) + h(s_start, s) + k_m, min(g(s), rhs(s))]
- k_m accumulates heuristic offset as vehicle moves along the path.
- When dynamic congestion or road blockage occurs, only the affected sub-branches of the search tree
  are updated, yielding up to a 10x-50x speedup over full A* recomputation.
"""

import math
import heapq
import time
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass
import networkx as nx

@dataclass
class DStarPathResult:
    path: List[int]
    travel_time_sec: float
    nodes_expanded: int
    replan_time_ms: float
    replanned_due_to_closure: bool

class PriorityQueue:
    def __init__(self):
        self._heap = []
        self._entries: Dict[int, Tuple[float, float]] = {}

    def insert_or_update(self, node: int, key: Tuple[float, float]):
        self._entries[node] = key
        heapq.heappush(self._heap, (key, node))

    def remove(self, node: int):
        self._entries.pop(node, None)

    def top_key(self) -> Tuple[float, float]:
        self._clean()
        if not self._entries:
            return (float('inf'), float('inf'))
        return self._heap[0][0]

    def pop(self) -> Tuple[int, Tuple[float, float]]:
        self._clean()
        if not self._entries:
            raise KeyError("Priority Queue is empty")
        key, node = heapq.heappop(self._heap)
        del self._entries[node]
        return node, key

    def contains(self, node: int) -> bool:
        return node in self._entries

    def is_empty(self) -> bool:
        self._clean()
        return len(self._entries) == 0

    def _clean(self):
        while self._heap and (
            self._heap[0][1] not in self._entries or
            self._heap[0][0] != self._entries[self._heap[0][1]]
        ):
            heapq.heappop(self._heap)


class DStarLite:
    """
    Incremental heuristic search engine for ambulances encountering dynamic road closures/jams.
    """

    def __init__(self, graph: nx.Graph, max_velocity_mps: float = 27.78):
        self.graph = graph
        self.v_max = max(1.0, max_velocity_mps)

        # Dynamic edge costs cache: (u, v) -> travel_time_sec
        self.edge_costs: Dict[Tuple[int, int], float] = {}
        self._init_edge_costs()

        self.start = -1
        self.goal = -1
        self.s_last = -1
        self.k_m = 0.0

        self.g: Dict[int, float] = {}
        self.rhs: Dict[int, float] = {}
        self.U = PriorityQueue()
        self.total_node_expansions = 0

    def _init_edge_costs(self):
        for u, v in self.graph.edges():
            length_m = self.graph[u][v].get("length_m", 1000.0)
            speed_kmh = self.graph[u][v].get("speed_kmh", 50.0)
            speed_mps = max(1.0, (speed_kmh * 1000.0) / 3600.0)
            cost = length_m / speed_mps
            self.edge_costs[(u, v)] = cost
            self.edge_costs[(v, u)] = cost

    def get_cost(self, u: int, v: int) -> float:
        return self.edge_costs.get((u, v), float('inf'))

    def heuristic(self, a: int, b: int) -> float:
        pos_a = self.graph.nodes[a].get("pos", (0.0, 0.0))
        pos_b = self.graph.nodes[b].get("pos", (0.0, 0.0))
        dist_m = math.hypot(pos_a[0] - pos_b[0], pos_a[1] - pos_b[1])
        return dist_m / self.v_max

    def calculate_key(self, s: int) -> Tuple[float, float]:
        min_val = min(self.g.get(s, float('inf')), self.rhs.get(s, float('inf')))
        k1 = min_val + self.heuristic(self.start, s) + self.k_m
        k2 = min_val
        return (k1, k2)

    def initialize(self, start_node: int, goal_node: int):
        self.start = start_node
        self.goal = goal_node
        self.s_last = self.start
        self.k_m = 0.0

        self.g.clear()
        self.rhs.clear()
        self.U = PriorityQueue()

        self.rhs[self.goal] = 0.0
        self.U.insert_or_update(self.goal, self.calculate_key(self.goal))

    def update_vertex(self, u: int):
        if u != self.goal:
            min_rhs = float('inf')
            for s_prime in self.graph.neighbors(u):
                c = self.get_cost(u, s_prime)
                val = c + self.g.get(s_prime, float('inf'))
                if val < min_rhs:
                    min_rhs = val
            self.rhs[u] = min_rhs

        self.U.remove(u)
        g_val = self.g.get(u, float('inf'))
        rhs_val = self.rhs.get(u, float('inf'))

        if not math.isclose(g_val, rhs_val, abs_tol=1e-6):
            self.U.insert_or_update(u, self.calculate_key(u))

    def compute_shortest_path(self) -> int:
        expansions = 0
        while not self.U.is_empty():
            k_old = self.U.top_key()
            k_start = self.calculate_key(self.start)

            g_start = self.g.get(self.start, float('inf'))
            rhs_start = self.rhs.get(self.start, float('inf'))

            # Termination condition
            if k_old >= k_start and math.isclose(rhs_start, g_start, abs_tol=1e-6):
                break

            u, _ = self.U.pop()
            expansions += 1
            self.total_node_expansions += 1
            k_new = self.calculate_key(u)

            if k_old < k_new:
                self.U.insert_or_update(u, k_new)
            elif self.g.get(u, float('inf')) > self.rhs.get(u, float('inf')):
                self.g[u] = self.rhs[u]
                for s in self.graph.neighbors(u):
                    self.update_vertex(s)
            else:
                self.g[u] = float('inf')
                self.update_vertex(u)
                for s in self.graph.neighbors(u):
                    self.update_vertex(s)

        return expansions

    def plan_path(self, start_node: int, goal_node: int) -> DStarPathResult:
        """Initial full planning from start to goal."""
        t_start = time.perf_counter()
        self.initialize(start_node, goal_node)
        expansions = self.compute_shortest_path()

        path = self._extract_path()
        t_ms = (time.perf_counter() - t_start) * 1000.0

        return DStarPathResult(
            path=path,
            travel_time_sec=self.g.get(self.start, float('inf')),
            nodes_expanded=expansions,
            replan_time_ms=t_ms,
            replanned_due_to_closure=False
        )

    def update_edge_cost(self, u: int, v: int, new_cost_sec: float) -> DStarPathResult:
        """
        Dynamically modifies the cost of edge (u, v) (e.g. traffic jam or road closure)
        and incrementally repairs the shortest path to goal.
        """
        t_start = time.perf_counter()
        self.k_m += self.heuristic(self.s_last, self.start)
        self.s_last = self.start

        self.edge_costs[(u, v)] = new_cost_sec
        self.edge_costs[(v, u)] = new_cost_sec

        self.update_vertex(u)
        self.update_vertex(v)

        expansions = self.compute_shortest_path()
        path = self._extract_path()
        t_ms = (time.perf_counter() - t_start) * 1000.0

        return DStarPathResult(
            path=path,
            travel_time_sec=self.g.get(self.start, float('inf')),
            nodes_expanded=expansions,
            replan_time_ms=t_ms,
            replanned_due_to_closure=True
        )

    def _extract_path(self) -> List[int]:
        if math.isinf(self.g.get(self.start, float('inf'))):
            return []

        curr = self.start
        path = [curr]
        visited = {curr}

        while curr != self.goal:
            best_neighbor = None
            min_cost = float('inf')

            for neighbor in self.graph.neighbors(curr):
                c = self.get_cost(curr, neighbor)
                val = c + self.g.get(neighbor, float('inf'))
                if val < min_cost:
                    min_cost = val
                    best_neighbor = neighbor

            if best_neighbor is None or best_neighbor in visited:
                break

            curr = best_neighbor
            path.append(curr)
            visited.add(curr)

        return path
