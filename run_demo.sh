#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# AURA-EMS: Autonomous Multi-Agent Ambulance Dispatch & Hospital Allocation
# One-Click Live Simulation & Interactive Web Cockpit Launcher
# Course: 23CSE301 Foundations of Artificial Intelligence · Amrita Vishwa Vidyapeetham
# ══════════════════════════════════════════════════════════════════════════════

set -e

# Move to the workspace root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ANSI Color Codes
C_CYAN='\033[0;36m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[1;33m'
C_RED='\033[0;31m'
C_BOLD='\033[1m'
C_RESET='\033[0m'

echo -e "${C_CYAN}══════════════════════════════════════════════════════════════════════════════${C_RESET}"
echo -e "${C_BOLD}🚑 AURA-EMS LIVE MULTI-AGENT SYSTEM LAUNCHER${C_RESET}"
echo -e "   Course: 23CSE301 FOAI · Amrita Vishwa Vidyapeetham"
echo -e "   Team: N. Aadesh (CSE23535), Akshar Sakhi (CSE23547), Nishanth (CSE23538)"
echo -e "   Dual Execution: Real Mesa Multi-Agent Engine + Interactive Web Cockpit"
echo -e "${C_CYAN}══════════════════════════════════════════════════════════════════════════════${C_RESET}"

# 1. Locate the correct Python interpreter with required dependencies
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
  echo -e "${C_YELLOW}[!] Probing default python3 for missing dependencies...${C_RESET}"
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
    echo -e "${C_YELLOW}[*] Installing required simulation dependencies...${C_RESET}"
    "$PYTHON_CMD" -m pip install -r Review_2/requirements.txt
  else
    echo -e "${C_RED}[ERROR] Python 3 with required libraries (mesa, networkx, scipy, yaml) not found.${C_RESET}"
    exit 1
  fi
fi

echo -e "${C_GREEN}✓ Using Python Interpreter:${C_RESET} $($PYTHON_CMD --version) ($PYTHON_CMD)"

# 2. Run Diagnostic Verification Suite (Rubric 1: 3 Marks)
echo -e "\n${C_CYAN}[*] Running System Diagnostic & Environment Verification...${C_RESET}"
"$PYTHON_CMD" Review_2/verify_setup.py

PORT=8000

# 3. Open browser presentation deck and live dashboard automatically in background
(
  sleep 1.2
  echo -e "${C_GREEN}[*] Launching Master Presentation Deck & Live Web Cockpit in your browser...${C_RESET}"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:${PORT}/Master_Review/"
    open "http://localhost:${PORT}/Review_2/dashboard.html"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "http://localhost:${PORT}/Master_Review/" >/dev/null 2>&1 &
      xdg-open "http://localhost:${PORT}/Review_2/dashboard.html" >/dev/null 2>&1 &
    fi
  fi
) &

# 4. Start Live Simulation Server with Dual Web API + Interactive Terminal Loop
echo -e "\n${C_CYAN}[*] Initializing High-Performance Python Mesa Backend on Port ${PORT}...${C_RESET}"
echo -e "${C_GREEN}✓ Live simulation auto-stepping active:${C_RESET} Terminal output & Browser Cockpit running simultaneously."
exec "$PYTHON_CMD" Review_2/server.py "${PORT}"
