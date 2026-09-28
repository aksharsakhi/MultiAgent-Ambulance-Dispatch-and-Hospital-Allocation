"""
Clinical Testing Scenarios & Stress-Test Suite
Module 03: Demo Quality & Testing Scenarios (3 Marks)

Implements 4 formal testing scenarios:
1. Scenario 1 (Baseline Urban Flow): Stochastic Poisson arrival under standard traffic.
2. Scenario 2 (Peak Hour Traffic Gridlock): Bottleneck river bridge speed drops to 25%, triggering D* Lite.
3. Scenario 3 (Mass Casualty Incident - MCI): Multi-casualty disaster testing auction concurrency & HEMS.
4. Scenario 4 (Hospital ER Saturation Surge): Central Trauma Center reaches 100% capacity, testing Gale-Shapley diversion.
"""

from enum import Enum
from typing import Dict, Any, Tuple
from .aura_model import AURASimulationModel
from .metrics_collector import MetricsCollector, SimulationRunSummary

class ScenarioType(Enum):
    BASELINE_NORMAL = "baseline_normal"
    TRAFFIC_GRIDLOCK = "traffic_gridlock"
    MASS_CASUALTY_INCIDENT = "mass_casualty_incident"
    HOSPITAL_SURGE = "hospital_surge"

class SimulationScenarioManager:
    """Manages setup and execution of the 4 benchmark test scenarios."""

    @staticmethod
    def run_scenario(
        scenario_type: ScenarioType,
        config: Dict[str, Any],
        duration_minutes: float = 60.0,
        time_step_sec: float = 5.0,
        seed: int = 42
    ) -> Tuple[AURASimulationModel, MetricsCollector, SimulationRunSummary]:
        """Runs the specified scenario and returns model, collector, and summary."""
        model = AURASimulationModel(config=config, time_step_sec=time_step_sec, seed=seed)
        collector = MetricsCollector(model)

        total_steps = int((duration_minutes * 60.0) / time_step_sec)

        # Apply Scenario Pre-conditions
        if scenario_type == ScenarioType.TRAFFIC_GRIDLOCK:
            # Severely congest the central bridge nodes (14, 15) and (20, 21)
            model.city_graph.set_road_blockage(14, 15, is_blocked=True)
            model.city_graph.update_traffic_conditions(model.current_time_sec, peak_hour_active=True)

        elif scenario_type == ScenarioType.HOSPITAL_SURGE:
            # Pre-saturate Hospital 1 (Apollo Metro) to 100% capacity
            hosp1 = model.get_hospital("HOSP-CENTRAL-01") or list(model.hospitals.values())[0]
            for i in range(hosp1.total_er_capacity):
                mock_inc = model.spawn_emergency(node_id=14, esi_level=3, specialty="GENERAL_SURGERY")
                hosp1.admit_patient(mock_inc)

        # Simulation Step Loop
        for step_idx in range(total_steps):
            # In MCI scenario: trigger disaster cluster at minute 10
            if scenario_type == ScenarioType.MASS_CASUALTY_INCIDENT:
                current_min = model.current_time_sec / 60.0
                if 10.0 <= current_min < 10.1:
                    # Spawn 10 casualties at intersection node 17
                    model.spawn_mci_event(node_id=17, count=10)

            model.step()
            collector.record_step()

        summary = collector.generate_summary(scenario_name=scenario_type.value)
        return model, collector, summary
