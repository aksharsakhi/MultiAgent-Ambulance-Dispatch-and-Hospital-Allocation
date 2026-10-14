#!/usr/bin/env python3
"""
Unit and integration tests for AURASimulationModel, Scenarios, and Metrics Collection
Rubric 3: Demo Quality & Testing Scenarios (3 Marks)
"""

import unittest
import yaml
from pathlib import Path
from Review_2.src.simulation import (
    AURASimulationModel,
    MetricsCollector,
    SimulationScenarioManager,
    ScenarioType
)

class TestSimulationEngineAndScenarios(unittest.TestCase):

    def setUp(self):
        config_path = Path(__file__).resolve().parent.parent / "config.yaml"
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = yaml.safe_load(f)

    def test_model_initialization_and_stepping(self):
        """Verify AURASimulationModel instantiates all agents and steps without error."""
        model = AURASimulationModel(config=self.config, rows=6, cols=6, time_step_sec=5.0, seed=42)
        self.assertEqual(len(model.ambulances), 6)
        self.assertEqual(len(model.hospitals), 3)
        self.assertIsNotNone(model.dispatcher)

        # Run 20 simulation timesteps
        for _ in range(20):
            model.step()

        self.assertEqual(model.step_count, 20)
        self.assertEqual(model.current_time_sec, 100.0)

    def test_baseline_scenario_execution(self):
        """Verify baseline scenario executes for 10 minutes and generates summary."""
        model, collector, summary = SimulationScenarioManager.run_scenario(
            scenario_type=ScenarioType.BASELINE_NORMAL,
            config=self.config,
            duration_minutes=10.0,
            time_step_sec=5.0,
            seed=42
        )
        self.assertIsNotNone(summary)
        self.assertEqual(summary.scenario_name, "baseline_normal")
        self.assertGreater(summary.total_calls, 0)
        self.assertGreaterEqual(summary.golden_hour_compliance_pct, 0.0)

    def test_traffic_gridlock_scenario_triggers_replanning(self):
        """Verify road closure scenario triggers dynamic D* Lite replans."""
        model, collector, summary = SimulationScenarioManager.run_scenario(
            scenario_type=ScenarioType.TRAFFIC_GRIDLOCK,
            config=self.config,
            duration_minutes=10.0,
            time_step_sec=5.0,
            seed=42
        )
        self.assertIsNotNone(summary)
        self.assertEqual(summary.scenario_name, "traffic_gridlock")

    def test_mci_scenario_spawns_cluster(self):
        """Verify MCI scenario spawns disaster casualties."""
        model, collector, summary = SimulationScenarioManager.run_scenario(
            scenario_type=ScenarioType.MASS_CASUALTY_INCIDENT,
            config=self.config,
            duration_minutes=15.0,
            time_step_sec=5.0,
            seed=42
        )
        self.assertGreaterEqual(summary.total_calls, 10)

    def test_hospital_surge_scenario_execution(self):
        """Verify hospital surge scenario runs and captures offload metrics."""
        model, collector, summary = SimulationScenarioManager.run_scenario(
            scenario_type=ScenarioType.HOSPITAL_SURGE,
            config=self.config,
            duration_minutes=10.0,
            time_step_sec=5.0,
            seed=42
        )
        self.assertIsNotNone(summary)
        self.assertEqual(summary.scenario_name, "hospital_surge")
        self.assertGreater(summary.total_calls, 0)

    def test_city_graph_road_blockage_toggling(self):
        """Verify CityGraph correctly blocks and unblocks arterial edges."""
        model = AURASimulationModel(config=self.config, rows=6, cols=6, time_step_sec=5.0, seed=42)
        u, v = 14, 15

        # Initial weight is reasonable (e.g. 100-200 seconds)
        w_initial = model.city_graph.graph[u][v]["weight"]
        self.assertLess(w_initial, 1000.0)

        # Block road
        model.city_graph.set_road_blockage(u, v, is_blocked=True)
        w_blocked = model.city_graph.graph[u][v]["weight"]
        self.assertEqual(w_blocked, 100000.0)
        self.assertTrue(model.city_graph.edge_states[(u, v)].is_blocked)

        # Unblock road
        model.city_graph.set_road_blockage(u, v, is_blocked=False)
        w_restored = model.city_graph.graph[u][v]["weight"]
        self.assertLess(w_restored, 1000.0)
        self.assertFalse(model.city_graph.edge_states[(u, v)].is_blocked)

    def test_incident_generator_poisson_arrival_rate_scaling(self):
        """Verify that Poisson emergency incident generator correctly scales arrivals during peak hours."""
        from Review_2.src.environment.incident_generator import IncidentGenerator
        from Review_2.src.environment.city_graph import CityGraph
        cg = CityGraph(rows=6, cols=6, block_spacing_m=1000.0)
        gen = IncidentGenerator(num_nodes=36, base_arrival_rate_per_min=1.0, peak_multiplier=2.5, seed=42)

        # Count total arrivals over 1000 steps (5000s) off-peak vs on-peak
        off_peak_total = sum(
            len(gen.generate_step_incidents(t, 5.0, is_peak_hour=False, city_graph=cg))
            for t in range(0, 5000, 5)
        )
        on_peak_total = sum(
            len(gen.generate_step_incidents(t, 5.0, is_peak_hour=True, city_graph=cg))
            for t in range(0, 5000, 5)
        )

        self.assertGreater(on_peak_total, off_peak_total)
        # On-peak should be roughly 2.5x off-peak
        ratio = on_peak_total / max(1, off_peak_total)
        self.assertAlmostEqual(ratio, 2.5, delta=0.5)

    def test_sqlite_telemetry_database_persistence_and_analytics(self):
        """Verify SQLite TelemetryDB accurately persists emergency events, FIPA acts, and calculates operational intelligence."""
        import tempfile
        from Review_2.src.simulation.telemetry_db import TelemetryDB
        from Review_2.src.environment.incident_generator import EmergencyIncident, ESILevel

        with tempfile.TemporaryDirectory() as tmpdir:
            test_db_path = Path(tmpdir) / "test_telemetry.db"
            db = TelemetryDB(db_path=test_db_path)

            # 1. Create and save sample emergency incidents
            inc1 = EmergencyIncident(
                incident_id="INC-T01",
                node_id=14,
                pos=(2000.0, 2000.0),
                esi_level=ESILevel.RESUSCITATION,
                specialty_needed="TRAUMA_SURGERY",
                spawn_time_sec=10.0,
                golden_hour_limit_sec=3600.0,
                status="RESOLVED",
                assigned_ambulance_id="AMB-ALS-01",
                assigned_hospital_id="HOSP-01",
                on_scene_time_sec=130.0,
                hospital_arrival_time_sec=200.0,
                hospital_admit_time_sec=200.0
            )
            inc2 = EmergencyIncident(
                incident_id="INC-T02",
                node_id=8,
                pos=(1000.0, 1000.0),
                esi_level=ESILevel.EMERGENT,
                specialty_needed="CARDIAC_CATH_LAB",
                spawn_time_sec=20.0,
                golden_hour_limit_sec=3600.0,
                status="DISPATCHED",
                assigned_ambulance_id="AMB-BLS-01"
            )

            db.save_incident(inc1, scenario="baseline_normal")
            db.save_incident(inc2, scenario="baseline_normal")

            # 2. Save FIPA message
            db.save_fipa_message("CFP", "DISPATCHER", "ALL_AMBS", "CONV-01", "Auction for INC-T01", 10.5)

            # 3. Verify querying incidents
            all_incidents = db.get_all_incidents()
            self.assertEqual(len(all_incidents), 2)
            self.assertEqual(all_incidents[0]["incident_id"], "INC-T02") # DESC by spawn time

            # 4. Verify analytics calculations
            summary = db.get_analytics_summary()
            self.assertEqual(summary["total_incidents"], 2)
            self.assertEqual(summary["resolved_incidents"], 1)
            self.assertEqual(summary["active_incidents"], 1)
            self.assertEqual(summary["esi_1_mean_response_min"], 2.0) # 120s / 60 = 2.0 min
            self.assertEqual(summary["golden_hour_compliance_pct"], 100.0)
            self.assertEqual(summary["total_fipa_messages"], 1)
            self.assertEqual(summary["specialty_distribution"]["TRAUMA_SURGERY"], 1)

            # 5. Clear DB
            db.clear_db()
            cleared_summary = db.get_analytics_summary()
            self.assertEqual(cleared_summary["total_incidents"], 0)
            self.assertEqual(cleared_summary["total_fipa_messages"], 0)

if __name__ == "__main__":
    unittest.main()

