# AURA-EMS Review 2: Multi-Agent Simulation Engine & Empirical Benchmarking
## Course: 23CSE301 Foundations of Artificial Intelligence · Amrita School of Computing
**Case Study: Decentralized Multi-Agent Ambulance Dispatch & Two-Sided Hospital Allocation**

---

### Review 2 Rubrics Mapping (10 Marks Total)

| Evaluation Rubric | Marks | Status | Architectural Artifacts |
| :--- | :---: | :---: | :--- |
| **Tool/Package Selection & Setup** | **3M** | ✅ Complete | Python Mesa 3.5, NetworkX, NumPy, SciPy, Matplotlib, `requirements.txt`, `config.yaml`, `verify_setup.py` |
| **Multi-Agent Execution & Interaction** | **3M** | ✅ Complete | FIPA-ACL Contract Net Protocol, Heterogeneous BDI Ambulances (ALS/BLS/NICU/HEMS), Dispatcher & Hospital Agents |
| **Demo Quality & Testing Scenarios** | **3M** | ✅ Complete | 4 Testing Scenarios (`baseline`, `traffic`, `mci`, `surge`), Empirical Benchmark vs CAD (+58.9% faster response), 4 Publication Plots |
| **Code Structure & Scalability** | **1M** | ✅ Complete | Modular OOP architecture (`src/`), 100% passing Unit Test Suite (`tests/`), interactive CLI Dashboard (`main.py`) |

---

### Quick Start Guide

#### 1. Verify Setup & Dependencies (Rubric 1 - 3M)
```bash
python3 main.py --verify
# Or directly:
python3 verify_setup.py
```

#### 2. Run Interactive Terminal Dashboard & Scenarios (Rubric 2 & 3 - 6M)
```bash
# Scenario 1: Baseline Urban Day
python3 main.py --scenario baseline

# Scenario 2: Peak Hour Traffic Gridlock (tests D* Lite dynamic replanning)
python3 main.py --scenario traffic

# Scenario 3: Mass Casualty Incident (tests multi-unit auction & HEMS helicopter)
python3 main.py --scenario mci

# Scenario 4: Hospital ER Saturation Surge (tests Gale-Shapley bed diversion)
python3 main.py --scenario surge
```

#### 3. Run Head-to-Head Empirical Benchmark vs Centralized CAD (Rubric 3 - 3M)
```bash
python3 main.py --benchmark
```
*Outputs a formatted comparative table and exports `benchmarks/benchmark_results.csv`.*

#### 4. Generate Publication-Quality Benchmark Plots
```bash
python3 main.py --plots
```
*Generates high-resolution PNG charts in `benchmarks/plots/`:*
- `response_time_comparison.png`
- `specialty_matching_rate.png`
- `offload_delay_reduction.png`
- `mci_disaster_clearance.png`

#### 5. Run Automated Unit & Integration Tests (Rubric 4 - 1M)
```bash
python3 -m unittest discover -s tests -p "test_*.py"
```

---

### Full Technical Documentation & Viva Defense Guide
See [`Review2_Comprehensive_Report.md`](file:///Users/aksharsakhi/Documents/Files/Code/Amrita/FOAI/CaseStudy/Review_2/Review2_Comprehensive_Report.md) for complete mathematical proofs, algorithmic formulations, complexity analyses, and model viva answers.
