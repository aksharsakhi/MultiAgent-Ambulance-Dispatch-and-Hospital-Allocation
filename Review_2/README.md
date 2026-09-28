# Review 2: Multi-Agent Simulation Engine & Empirical Benchmarking
## Course: 23CSE301 Foundations of Artificial Intelligence — Amrita School of Computing
**Case Study: Decentralized Multi-Agent Ambulance Dispatch & Two-Sided Hospital Allocation**

---

### Review 2 Architecture & Implementation Plan

Review 2 builds upon the formal mathematical and multi-agent modeling established in **Review 1** (PEAS Formulation, Russell & Norvig 7-Dimension Analysis, Time-Dependent A*, and Gale-Shapley Stable Matching).

```
Review_2/
├── README.md                           <- This implementation blueprint
├── requirements.txt                    <- Python dependencies (mesa, osmnx, networkx, matplotlib)
├── config.yaml                         <- Simulation hyper-parameters (fleet size, call rate, weights)
├── src/
│   ├── environment/
│   │   ├── city_graph.py               <- OSMnx urban road network loader & speed limits
│   │   └── incident_generator.py       <- Non-homogeneous Poisson call arrival stream
│   ├── agents/
│   │   ├── dispatcher_agent.py         <- Central CAD FIPA-ACL auction coordinator
│   │   ├── ambulance_agent.py          <- Autonomous vehicle agent (TDA*, D* Lite replan)
│   │   └── hospital_agent.py           <- Emergency Dept agent (dynamic bed capacity & surcharges)
│   ├── algorithms/
│   │   ├── time_dependent_astar.py     <- TDA* shortest-time search implementation
│   │   ├── d_star_lite.py              <- Incremental dynamic replanning for road closures
│   │   └── gale_shapley_matching.py    <- Bilateral deferred acceptance hospital matcher
│   └── simulation/
│       ├── mesa_model.py               <- Mesa Model & Multi-Agent schedule loop
│       └── metrics_collector.py        <- DataCollector for Response Time, Offload Delay, & Survival
└── benchmarks/
    ├── run_experiments.py              <- Benchmark AURA-EMS vs Centralized Nearest CAD (1,000 runs)
    └── plots/                          <- Exported comparative performance graphs
```

---

### Key Deliverables for Review 2 Evaluation:
1. **Real-World Urban Graph:** Ingestion of Coimbatore / Bengaluru street network via `OSMnx`.
2. **Decentralized Negotiation:** Full implementation of FIPA-ACL Contract Net Protocol (CFP, Bid, Award) in Python Mesa.
3. **Empirical Benchmarks:** Empirical comparison between AURA-EMS and Centralized Greedy CAD across:
   * **Mean Response Latency (min)**
   * **Ambulance Offload Delay / Ramping (min)**
   * **Clinical Specialty Match Rate (%)**
   * **City-wide Fleet Starvation Events**
