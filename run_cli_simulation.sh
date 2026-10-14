#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# AURA-EMS: Autonomous Multi-Agent Ambulance Dispatch & Hospital Allocation
# Interactive Terminal Simulation Engine (Real Python Mesa Multi-Agent Model)
# Course: 23CSE301 Foundations of Artificial Intelligence · Amrita Vishwa Vidyapeetham
# ══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

C_CYAN='\033[0;36m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[1;33m'
C_BOLD='\033[1m'
C_RESET='\033[0m'

PYTHON_CMD=""
CANDIDATES=(
  "/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
  "/opt/homebrew/bin/python3"
  "$(which python3 2>/dev/null || true)"
  "$(which python 2>/dev/null || true)"
)

for p in "${CANDIDATES[@]}"; do
  if [ -x "$p" ] && "$p" -c "import mesa, networkx, scipy, yaml" 2>/dev/null; then
    PYTHON_CMD="$p"
    break
  fi
done

if [ -z "$PYTHON_CMD" ]; then
  PYTHON_CMD="python3"
fi

echo -e "${C_CYAN}══════════════════════════════════════════════════════════════════════════════${C_RESET}"
echo -e "${C_BOLD}🚑 AURA-EMS TERMINAL SIMULATION ENGINE (REAL MULTI-AGENT EXECUTION)${C_RESET}"
echo -e "   Course: 23CSE301 FOAI · Amrita Vishwa Vidyapeetham"
echo -e "${C_CYAN}══════════════════════════════════════════════════════════════════════════════${C_RESET}"
echo -e "Select a real simulation scenario to execute live in your terminal:\n"
echo -e "  ${C_BOLD}[1]${C_RESET} Baseline Urban Normal (Stochastic Poisson arrivals, TDA* routing, Gale-Shapley)"
echo -e "  ${C_BOLD}[2]${C_RESET} Peak Traffic Bottleneck Gridlock (Bridge blockage, D* Lite dynamic replanning)"
echo -e "  ${C_BOLD}[3]${C_RESET} Mass Casualty Incident (MCI) Disaster (10 simultaneous casualties at Node 17)"
echo -e "  ${C_BOLD}[4]${C_RESET} Hospital ER Saturation Surge (100% Apollo ER load, Gale-Shapley diversion)"
echo -e "  ${C_BOLD}[5]${C_RESET} 100-Episode Monte Carlo Benchmark vs Centralized CAD Baseline"
echo -e "  ${C_BOLD}[6]${C_RESET} Run Complete Diagnostic Setup Verification Suite (Rubric 1)"
echo -e "  ${C_BOLD}[7]${C_RESET} Re-generate Publication-Grade Benchmark Plots\n"
read -r -p "Enter choice [1-7] (default 1): " choice
choice=${choice:-1}

case "$choice" in
  1)
    echo -e "\n${C_GREEN}[*] Executing Baseline Scenario (Real Mesa Engine)...${C_RESET}"
    exec "$PYTHON_CMD" Review_2/main.py --scenario baseline --duration 15
    ;;
  2)
    echo -e "\n${C_GREEN}[*] Executing Peak Traffic Gridlock Scenario (Dynamic D* Lite)...${C_RESET}"
    exec "$PYTHON_CMD" Review_2/main.py --scenario traffic --duration 15
    ;;
  3)
    echo -e "\n${C_GREEN}[*] Executing Mass Casualty Incident (MCI) Disaster Scenario...${C_RESET}"
    exec "$PYTHON_CMD" Review_2/main.py --scenario mci --duration 15
    ;;
  4)
    echo -e "\n${C_GREEN}[*] Executing Hospital ER Saturation Surge Scenario...${C_RESET}"
    exec "$PYTHON_CMD" Review_2/main.py --scenario surge --duration 15
    ;;
  5)
    echo -e "\n${C_GREEN}[*] Running 100-Episode Monte Carlo Empirical Benchmark...${C_RESET}"
    exec "$PYTHON_CMD" Review_2/main.py --benchmark
    ;;
  6)
    echo -e "\n${C_GREEN}[*] Running Setup Diagnostic Suite...${C_RESET}"
    exec "$PYTHON_CMD" Review_2/main.py --verify
    ;;
  7)
    echo -e "\n${C_GREEN}[*] Generating Benchmark Plots...${C_RESET}"
    exec "$PYTHON_CMD" Review_2/main.py --plots
    ;;
  *)
    echo -e "${C_YELLOW}[!] Invalid choice, running baseline scenario by default...${C_RESET}"
    exec "$PYTHON_CMD" Review_2/main.py --scenario baseline --duration 10
    ;;
esac
