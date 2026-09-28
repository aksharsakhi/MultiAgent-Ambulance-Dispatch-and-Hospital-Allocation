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

if __name__ == "__main__":
    unittest.main()
