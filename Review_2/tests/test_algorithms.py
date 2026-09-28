#!/usr/bin/env python3
"""
Unit tests for Time-Dependent A*, D* Lite Replanning, and Gale-Shapley Stable Matching
"""

import unittest
import networkx as nx
import math
from Review_2.src.algorithms import (
    TimeDependentAStar,
    DStarLite,
    GaleShapleyMatcher,
    PatientRequest,
    HospitalResource
)

class TestSearchAndMatchingAlgorithms(unittest.TestCase):

    def setUp(self):
        # 4x4 Grid Network
        self.G = nx.grid_2d_graph(4, 4)
        self.G = nx.convert_node_labels_to_integers(self.G)
        for i in range(16):
            r, c = divmod(i, 4)
            self.G.nodes[i]["pos"] = (c * 2000.0, r * 2000.0) # 2km spacing

        for u, v in self.G.edges():
            self.G[u][v]["length_m"] = 2000.0
            self.G[u][v]["speed_kmh"] = 60.0

    def test_tda_star_optimal_path(self):
        """Verify TDA* finds the direct shortest path from 0 to 15."""
        planner = TimeDependentAStar(self.G, max_velocity_mps=20.0)
        res = planner.find_shortest_time_path(start_node=0, goal_node=15, departure_time_sec=0.0)
        self.assertIsNotNone(res)
        self.assertEqual(res.path[0], 0)
        self.assertEqual(res.path[-1], 15)
        self.assertEqual(len(res.path), 7) # Manhattan distance on 4x4 grid is 6 steps = 7 nodes
        self.assertGreater(res.travel_time_sec, 0.0)

    def test_d_star_lite_dynamic_replanning(self):
        """Verify D* Lite successfully reroutes around a dynamically closed edge."""
        dstar = DStarLite(self.G, max_velocity_mps=20.0)
        res_initial = dstar.plan_path(start_node=0, goal_node=15)
        self.assertIn(0, res_initial.path)
        self.assertIn(15, res_initial.path)

        # Pick the second node in initial path and block the forward edge
        first_step = res_initial.path[0]
        second_step = res_initial.path[1]

        # Block this edge by setting travel time to infinity (or 100,000s)
        res_replan = dstar.update_edge_cost(first_step, second_step, new_cost_sec=100000.0)
        self.assertTrue(res_replan.replanned_due_to_closure)
        self.assertEqual(res_replan.path[0], 0)
        self.assertEqual(res_replan.path[-1], 15)
        # Ensure the blocked edge is not used
        path_edges = list(zip(res_replan.path[:-1], res_replan.path[1:]))
        self.assertNotIn((first_step, second_step), path_edges)
        self.assertNotIn((second_step, first_step), path_edges)

    def test_gale_shapley_stability_and_zero_blocking_pairs(self):
        """Verify Gale-Shapley matching produces zero blocking pairs."""
        matcher = GaleShapleyMatcher()

        patients = [
            PatientRequest(
                patient_id="P1", incident_node=0, esi_level=1,
                specialty_needed="TRAUMA_SURGERY", pos=(0.0, 0.0),
                arrival_time_sec=10.0, ambulance_id="A1"
            ),
            PatientRequest(
                patient_id="P2", incident_node=3, esi_level=2,
                specialty_needed="CARDIAC_CATH_LAB", pos=(6000.0, 0.0),
                arrival_time_sec=12.0, ambulance_id="A2"
            ),
            PatientRequest(
                patient_id="P3", incident_node=12, esi_level=3,
                specialty_needed="GENERAL_SURGERY", pos=(0.0, 6000.0),
                arrival_time_sec=15.0, ambulance_id="A3"
            ),
        ]

        hospitals = [
            HospitalResource(
                hospital_id="H1", name="Trauma Regional", node_id=1,
                pos=(2000.0, 0.0), trauma_level=1, total_er_capacity=2,
                current_occupied_beds=1, specialties={"TRAUMA_SURGERY", "CARDIAC_CATH_LAB"}
            ),
            HospitalResource(
                hospital_id="H2", name="Community North", node_id=15,
                pos=(6000.0, 6000.0), trauma_level=3, total_er_capacity=2,
                current_occupied_beds=0, specialties={"GENERAL_SURGERY"}
            ),
        ]

        result = matcher.match(patients, hospitals)
        self.assertEqual(len(result.allocation), 3)
        # Stable allocation must have 0 blocking pairs
        self.assertEqual(result.blocking_pairs_count, 0)
        # High trauma patient P1 (ESI-1) should get Level 1 hospital H1
        self.assertEqual(result.allocation["P1"], "H1")

if __name__ == "__main__":
    unittest.main()
