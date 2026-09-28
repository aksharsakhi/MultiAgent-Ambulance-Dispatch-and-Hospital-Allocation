#!/usr/bin/env python3
"""
AURA-EMS Review 2: Multi-Agent Simulation Engine & Interactive CLI Dashboard
Course: 23CSE301 Foundations of Artificial Intelligence · Amrita Vishwa Vidyapeetham

Usage:
  python3 main.py --scenario baseline   # Run baseline urban scenario
  python3 main.py --scenario traffic    # Run peak traffic bottleneck gridlock
  python3 main.py --scenario mci        # Run Mass Casualty Incident (MCI) disaster
  python3 main.py --scenario surge      # Run hospital ER saturation & surge
  python3 main.py --benchmark           # Run empirical comparison vs Centralized CAD
  python3 main.py --verify              # Run environment setup verification (Rubric 1)
  python3 main.py --plots               # Generate publication benchmark charts
"""

import sys
import argparse
import time
from pathlib import Path
import yaml
from tabulate import tabulate

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT.parent))

from Review_2.src.simulation.scenarios import SimulationScenarioManager, ScenarioType
from Review_2.src.simulation.aura_model import AURASimulationModel
from Review_2.src.simulation.metrics_collector import MetricsCollector
from Review_2.benchmarks.benchmark_engine import BenchmarkEngine
from Review_2.benchmarks.generate_plots import main as generate_all_plots
from Review_2.verify_setup import main as run_verification

def render_ascii_grid(model: AURASimulationModel):
    """Renders a 6x6 visual ASCII representation of the city grid with agent locations."""
    rows, cols = model.city_graph.rows, model.city_graph.cols
    grid = [[" . " for _ in range(cols)] for _ in range(rows)]

    # Mark Hospitals
    for h in model.hospitals.values():
        r, c = divmod(h.node_id, cols)
        grid[r][c] = "🏥H"

    # Mark Incidents
    for inc in model.incidents.values():
        r, c = divmod(inc.node_id, cols)
        if inc.status in ("UNASSIGNED", "IN_AUCTION"):
            grid[r][c] = "🚨E"
        elif inc.status in ("DISPATCHED", "ON_SCENE"):
            grid[r][c] = "⚠️P"

    # Mark Ambulances
    for amb in model.ambulances.values():
        r, c = divmod(amb.current_node, cols)
        if amb.is_hems:
            grid[r][c] = "🚁A"
        elif amb.state == "IDLE":
            grid[r][c] = "🚑S"
        else:
            grid[r][c] = "🚑*"

    print("\n  [METROPOLITAN EMERGENCY DISPATCH GRID - 6x6 SECTOR]")
    print("  " + "—" * 31)
    for r in range(rows):
        row_str = " | ".join(grid[r])
        print(f"  | {row_str} |")
    print("  " + "—" * 31)
    print("  Legend: 🏥H = Hospital ER | 🚑S = Standby Amb | 🚑* = Transit | 🚨E = 911 Call | 🚁A = Air HEMS")

def run_interactive_simulation(scenario_type: ScenarioType, duration_mins: float = 30.0, speed: float = 0.05):
    """Executes a live visual interactive simulation in the terminal."""
    config_path = PROJECT_ROOT / "config.yaml"
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    print("\n" + "═" * 82)
    print(f"  STARTING AURA-EMS INTERACTIVE SCENARIO: {scenario_type.value.upper()}")
    print("═" * 82)

    model = AURASimulationModel(config=config, rows=6, cols=6, time_step_sec=5.0, seed=42)
    collector = MetricsCollector(model)
    total_steps = int((duration_mins * 60.0) / 5.0)

    # Scenario Preconditions
    if scenario_type == ScenarioType.TRAFFIC_GRIDLOCK:
        print("[!] Applying peak-hour traffic bottleneck to central river bridges (Nodes 14-15)...")
        model.city_graph.set_road_blockage(14, 15, is_blocked=True)
        model.city_graph.update_traffic_conditions(0.0, peak_hour_active=True)

    elif scenario_type == ScenarioType.HOSPITAL_SURGE:
        print("[!] Pre-saturating Central Trauma Center to 100% capacity...")
        h1 = list(model.hospitals.values())[0]
        for _ in range(h1.total_er_capacity):
            mock_inc = model.spawn_emergency(node_id=14, esi_level=3)
            h1.admit_patient(mock_inc)

    for step_i in range(1, total_steps + 1):
        # Trigger disaster in MCI scenario
        if scenario_type == ScenarioType.MASS_CASUALTY_INCIDENT and step_i == 10:
            print("\n🚨 [ALARM: MASS CASUALTY INCIDENT] 10 casualties reported at intersection node 17!")
            model.spawn_mci_event(node_id=17, count=10)

        model.step()
        collector.record_step()

        # Render display every 6 steps (every 30 seconds of sim time)
        if step_i % 6 == 0 or step_i == 1:
            sim_time_min = model.current_time_sec / 60.0
            print(f"\n[Step {step_i:04d} · Sim Time: {sim_time_min:.1f} min] Active Calls: {len(model.incidents)} | Resolved: {len(model.resolved_incidents)}")
            render_ascii_grid(model)

            # Print Fleet Status
            fleet_rows = []
            for a in model.ambulances.values():
                fleet_rows.append([
                    a.agent_id, a.vehicle_type, f"Node {a.current_node}",
                    a.state, f"{a.remaining_fuel_km:.0f}/{a.fuel_capacity_km:.0f} km",
                    f"{a.total_incidents_handled} calls"
                ])
            print("\n" + tabulate(fleet_rows, headers=["Ambulance ID", "Type", "Location", "BDI State", "Fuel Range", "Handled"], tablefmt="simple"))

            # Print Hospital Status
            hosp_rows = []
            for h in model.hospitals.values():
                hosp_rows.append([
                    h.name[:25], f"Level {h.trauma_level}",
                    f"{h.current_occupied_beds}/{h.total_er_capacity}",
                    f"{h.occupancy_rate:.0f}%",
                    f"{h.total_patients_admitted} admits"
                ])
            print("\n" + tabulate(hosp_rows, headers=["Hospital ER", "Trauma Level", "Occupancy", "Load %", "Admits"], tablefmt="simple"))

            # Show latest FIPA-ACL messages
            if model.message_bus.message_log:
                latest = model.message_bus.message_log[-3:]
                print("\n  [FIPA-ACL TELEMETRY CONSOLE STREAM]")
                for m in latest:
                    print(f"  • {m.performative.value:<14} from {m.sender:<12} -> {m.receiver:<16} | conv: {m.conversation_id}")

            if speed > 0:
                time.sleep(speed)

    summary = collector.generate_summary(scenario_name=scenario_type.value)
    print("\n" + "═" * 82)
    print(f"  SCENARIO EXECUTION COMPLETED: {scenario_type.value.upper()}")
    print("═" * 82)
    summary_data = [
        ["Total Incidents Spawned", summary.total_calls],
        ["Successfully Resolved", summary.resolved_calls],
        ["Mean Response Latency", f"{summary.mean_response_time_min:.2f} min"],
        ["ESI-1 Life-Threat Latency", f"{summary.esi_1_mean_response_min:.2f} min"],
        ["Golden Hour Compliance", f"{summary.golden_hour_compliance_pct:.1f}%"],
        ["Ambulance Offload Delay", f"{summary.mean_offload_delay_min:.2f} min"],
        ["Specialty Match Rate", f"{summary.specialty_match_rate_pct:.1f}%"],
        ["Dynamic D* Lite Replans", summary.total_dynamic_replans],
        ["Mean Fleet Utilization", f"{summary.mean_fleet_utilization_pct:.1f}%"]
    ]
    print(tabulate(summary_data, headers=["Performance Metric", "Observed Value"], tablefmt="fancy_grid"))

def main():
    parser = argparse.ArgumentParser(
        description="AURA-EMS Review 2: Multi-Agent Simulation Engine & Interactive CLI Dashboard"
    )
    parser.add_argument(
        "--scenario",
        type=str,
        choices=["baseline", "traffic", "mci", "surge"],
        help="Execute an interactive test scenario"
    )
    parser.add_argument("--benchmark", action="store_true", help="Run empirical benchmark comparison vs Centralized CAD")
    parser.add_argument("--verify", action="store_true", help="Run environment and package verification suite (Rubric 1)")
    parser.add_argument("--plots", action="store_true", help="Generate publication-grade benchmark plots")
    parser.add_argument("--duration", type=float, default=20.0, help="Scenario duration in minutes (default: 20)")
    parser.add_argument("--fast", action="store_true", help="Run without UI sleep delay")

    args = parser.parse_args()

    if args.verify:
        run_verification()
    elif args.benchmark:
        engine = BenchmarkEngine()
        engine.run_comparison(duration_minutes=60.0, seed=42)
    elif args.plots:
        generate_all_plots()
    elif args.scenario:
        scenario_map = {
            "baseline": ScenarioType.BASELINE_NORMAL,
            "traffic": ScenarioType.TRAFFIC_GRIDLOCK,
            "mci": ScenarioType.MASS_CASUALTY_INCIDENT,
            "surge": ScenarioType.HOSPITAL_SURGE
        }
        delay = 0.0 if args.fast else 0.05
        run_interactive_simulation(scenario_map[args.scenario], duration_mins=args.duration, speed=delay)
    else:
        # Default behavior: run verification and short baseline demo
        print("\n[+] No arguments specified. Running default diagnostic verification...")
        run_verification()
        print("\n[+] Running short baseline scenario demonstration...")
        run_interactive_simulation(ScenarioType.BASELINE_NORMAL, duration_mins=10.0, speed=0.0)

if __name__ == "__main__":
    main()
