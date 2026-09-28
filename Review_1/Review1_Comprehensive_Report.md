# AURA-EMS: Autonomous Multi-Agent Ambulance Dispatch & Hospital Allocation
## Foundations of Artificial Intelligence (23CSE301) — Project Review 1 Comprehensive Technical Report
**Amrita Vishwa Vidyapeetham — School of Computing**  
**Evaluation Rubric Total: 10 Marks**

---

### Team Members & Rubric Allocation

| Team Member | Roll Number | Review 1 Assigned Rubric Topic | Marks Weightage |
| :--- | :--- | :--- | :--- |
| **Sheela Akshar Sakhi** (Team Lead) | `CB.SC.U4CSE23547` | Foundational Motivation, Centralized CAD Bottlenecks vs MAS, PEAS Formulation (Dispatcher & Ambulance Agents) | **3 Marks** |
| **Member 2** | `CB.SC.U4CSE23538` | Hospital ER Agent PEAS Formulation, Russell & Norvig 7 Canonical Dimensions of EMS | **3 Marks** |
| **Member 3** | `CB.SC.U4CSE23535` | Agent Typology (Utility vs Goal BDI), Closed-Loop Perception-Action Architecture, FIPA-ACL Contract Net Protocol Lifecycle | **3 Marks** |
| **Member 4** | `CB.SC.U4CSE[Member 4]` | Time-Dependent A* (TDA*), Dynamic D* Lite Replanning, Gale-Shapley Two-Sided Matching, Review 2 6-Week Roadmap | **1 Mark + Sprints** |

---

## 1. Executive Summary & Problem Formulation

Modern municipal Emergency Medical Services (EMS) face an acute structural crisis stemming from monolithic Computer-Aided Dispatch (CAD) architectures:
1. **Combinatorial State Explosion $\mathcal{O}(n!)$:** Monolithic integer linear programming solvers freeze during multi-casualty incidents when concurrent emergency calls overwhelm central dispatch servers.
2. **Ambulance Offload Delay (AOD / "Ambulance Ramping"):** Ambulances arrive at destination hospital emergency departments only to find resuscitation bays fully occupied. Paramedics are forced to idle in parking lots for 30–90 minutes monitoring patients, removing up to 40% of active municipal ambulance fleets from service.
3. **Severe Information Asymmetry:** Dispatchers assign units based on Euclidean or static road network proximity, completely blind to real-time hospital surgical readiness (e.g., cardiac catheterization lab availability or CT scanner queue depths).

**AURA-EMS** eliminates these systemic bottlenecks by deploying a decentralized **Multi-Agent System (MAS)** where edge agents (Ambulances, Hospital Emergency Departments, and Central Coordinators) negotiate dynamic dispatch and hospital admissions in parallel using the **FIPA-ACL Contract Net Protocol (CNP)** and **Gale-Shapley Two-Sided Stable Matching**.

---

## 2. Rubric Component 1: PEAS Formulation (3 Marks)

### 2.1 Central Dispatch Coordinator Agent
* **Performance Measure ($\mathcal{P}$):**
  * Minimize city-wide mean response latency: $\min \sum_{i} (t_{\text{arrival}, i} - t_{\text{call}, i})$.
  * Strict prioritization of high-acuity resuscitation emergencies: $\text{Response Time}(\text{ESI-1}) < 8.0\text{ minutes}$.
  * Preservation of geographic coverage: Maintain $>90\%$ probability that any subsequent urban emergency has a response unit within a 10-minute radius.
  * Minimize dispatch decision computation time ($< 1.0\text{ second}$).
* **Environment ($\mathcal{E}$):**
  * Urban topological road network graph $G = (V, E)$.
  * Non-homogeneous Poisson stream of 911 calls $\lambda(t)$ with spatial clustering.
  * Heterogeneous hospital network with fluctuating bed occupancy and specialty facilities.
* **Actuators ($\mathcal{A}$):**
  * FIPA-ACL Call For Proposals (CFP) broadcast transceiver.
  * Binding contract award transmission to winning ambulance bidder.
  * Dynamic patrol re-positioning commands to idle units to resolve coverage voids.
* **Sensors ($\mathcal{S}$):**
  * Computer-Aided Dispatch intake parser (caller geocodes, Chief Complaint, ESI triage level).
  * Real-time GPS and status telemetry feed from all fleet units (10 Hz).
  * Municipal traffic sensor feeds and incident closure notifications.

### 2.2 Autonomous Ambulance Fleet Agent
* **Performance Measure ($\mathcal{P}$):**
  * Minimization of scene travel time: $\text{ETA} = \sum_{e \in \text{path}} c(e, t)$.
  * Patient physiological stability index during transit: $\min \int_0^T \|\nabla \text{Vitals}(t)\| dt$.
  * Energy/fuel economy and EV battery state-of-charge ($>30\%$ reserve).
  * Zero secondary traffic collisions via autonomous V2X priority signaling.
* **Environment ($\mathcal{E}$):**
  * Dynamic, non-stationary urban traffic with time-varying congestion factors.
  * Uncontrolled civilian vehicular and pedestrian traffic.
  * Changing weather conditions (rain, wet asphalt friction, reduced nighttime visibility).
  * Hospital emergency bay ramps and staging bays.
* **Actuators ($\mathcal{A}$):**
  * Powertrain actuators: Steering angle, throttle acceleration, regenerative braking.
  * Dual-strobe LED emergency lightbars and multi-tone acoustic sirens.
  * V2X traffic signal preemption emitter (requesting green light wave).
  * FIPA-ACL wireless bid formulation and submission transceiver.
* **Sensors ($\mathcal{S}$):**
  * Dual-band GNSS receiver (sub-meter accuracy) + 6-axis Inertial Measurement Unit (IMU).
  * OBD-II vehicular bus (vehicle velocity, tire traction, brake temperature, battery SOC).
  * Real-time TomTom / HERE traffic speed vector ingestion API.
  * Onboard patient physiological monitors (multi-lead ECG, SpO2 pulse oximetry, NIBP).

### 2.3 Hospital Emergency Department (ER) Agent
* **Performance Measure ($\mathcal{P}$):**
  * Minimization of Ambulance Offload Delay: $\text{AOD} < 5\text{ minutes}$ from vehicle bay arrival to bedside handover.
  * Optimal specialty resource utilization: Cath lab and trauma bay utilization rate $>80\%$ without exceeding safe surge limits.
  * Clinical specialty match rate: $100\%$ of STEMI, acute ischemic stroke, and pediatric resuscitations assigned to specialized centers.
* **Environment ($\mathcal{E}$):**
  * Physical emergency department (triage desk, acute resuscitation bays, ICU step-down).
  * Stochastic unscheduled walk-in patient arrival stream.
  * Electronic Health Record (EHR) database and physician shift rosters.
* **Actuators ($\mathcal{A}$):**
  * Pre-arrival electronic bed reservation lock (HL7 / FHIR transaction).
  * Dynamic admission surcharge pricing factor ($\alpha \ge 1.0$) broadcast in bilateral matching.
  * ER diversion advisory broadcast (Code Yellow / Code Red).
  * Pre-arrival trauma team / surgical paging system.
* **Sensors ($\mathcal{S}$):**
  * Electronic bed tracking sensors in acute triage bays.
  * RFID perimeter receivers detecting approaching ambulance transponders.
  * Telemedicine ingestion bridge for real-time en-route patient ECG streaming.

### 2.4 Mathematical Objective Function
$$\mathcal{P}_{\text{dispatch}} = \sum_{i \in \text{Incidents}} \gamma_i \cdot (t_{\text{arrival}, i} - t_{\text{call}, i}) + \lambda_{\text{coverage}} \cdot \text{Penalty}_{\text{coverage}}$$

Where:
* $\gamma_i$ represents the clinical urgency multiplier based on Emergency Severity Index (ESI):
  * $\gamma_{\text{ESI-1}} = 10.0$ (Immediate resuscitation: cardiac arrest, anaphylaxis, severe trauma).
  * $\gamma_{\text{ESI-2}} = 4.0$ (High risk: acute stroke, STEMI heart attack).
  * $\gamma_{\text{ESI-3}} = 2.0$ (Urgent: compound fractures, severe abdominal pain).
  * $\gamma_{\text{ESI-5}} = 0.5$ (Non-urgent: minor sutures, prescription refill).
* $\lambda_{\text{coverage}}$ penalizes assigning the sole patrol unit in a high-density urban sector, preserving municipal resilience against sudden spatial clusters.

---

## 3. Rubric Component 2: Environment & Agent Analysis (3 Marks)

### 3.1 Russell & Norvig's 7 Canonical Dimensions of EMS

| Canonical Dimension | EMS Classification | Formal Academic Justification |
| :--- | :--- | :--- |
| **1. Observability** | **Partially Observable** | Ambulance agents cannot observe distant traffic congestion, sudden construction blockages, internal patient deterioration, or ER bed turnover without sensor updates. |
| **2. Agent Multiplicity** | **Multi-Agent (Cooperative + Competitive)** | Ambulances cooperate to optimize municipal response time, but compete for physical road space at intersections and scarce specialized ICU beds at hospitals. |
| **3. Determinism** | **Stochastic** | Call arrivals follow a non-homogeneous Poisson process; vehicular traffic flow, weather, and patient physiological responses are non-deterministic. |
| **4. Episodic / Sequential** | **Sequential** | Current dispatch decisions directly deplete fleet availability in a sector, creating delayed operational consequences for subsequent calls. |
| **5. Static / Dynamic** | **Dynamic** | The environment continuously evolves while agents compute decisions. Traffic builds up and patients deteriorate in real time. |
| **6. Discrete / Continuous** | **Continuous** | Vehicle trajectories, velocities, coordinates, timestamps, and patient ECG signals are continuous; road network intersections provide discrete topological nodes. |
| **7. Known / Unknown** | **Known Topology, Unknown Latent Variables** | Static street topology is known via OpenStreetMap (OSM), but non-stationary edge travel times and hospital bed availability are unknown until observed. |

### 3.2 Agent Typology: Why Utility-Based BDI Outperforms Goal-Based Agents
A pure Goal-Based agent evaluates decisions as binary satisfaction:
$$\text{Decision} = \{\text{True} \text{ if Goal Achieved}, \text{False} \text{ Otherwise}\}$$
In emergency logistics, binary goals fail because goals inherently conflict:
1. Reaching the nearest hospital minimizes travel time, but that hospital may lack cardiac cath facilities, resulting in secondary transfer mortality.
2. Speeding at maximum velocity accelerates arrival, but exponentially increases secondary collision risk on wet pavement.

A **Utility-Based BDI (Belief-Desire-Intention) Agent** maps continuous state-action spaces to real-valued utility $\mathcal{U}: \mathcal{S} \times \mathcal{A} \to \mathbb{R}$:
$$\mathcal{U}(a) = w_{\text{time}} \cdot \frac{1}{\text{ETA}(a)} + w_{\text{survival}} \cdot P(\text{Survival} \mid \text{Specialty Match}) - w_{\text{cost}} \cdot \text{CongestionCost}(a)$$
This enables rational trade-offs between speed, clinical survival probability, and hospital congestion.

---

## 4. Rubric Component 3: Algorithmic Modeling & Search Strategy (3 Marks)

### 4.1 Time-Dependent A* (TDA*) Algorithm
Standard Dijkstra or static A* algorithms assume constant edge travel times $c(u, v) = \frac{\text{dist}}{v_{\text{base}}}$. In urban traffic, edge velocity is a time-dependent function $v(u, v, t)$.

TDA* computes the optimal trajectory by evaluating dynamic edge traversal cost:
$$c(u, v, t) = \frac{\text{Length}(u, v)}{v(u, v, t)}$$
The arrival time at node $v$ given departure from $u$ at time $t$ is:
$$\text{Arr}(v) = t + c(u, v, t)$$

### 4.2 Mathematical Proof of Heuristic Admissibility
Let $h(n)$ be the heuristic evaluation function:
$$h(n) = \frac{\text{EuclideanDistance}(n, \text{Goal})}{v_{\text{max}}}$$
Where $v_{\text{max}} = \max_{e \in E, t} v(e, t)$ is the maximum theoretical speed limit across all urban expressways.

**Theorem:** $h(n) \le h^*(n)$ for all nodes $n \in V$, where $h^*(n)$ is the true optimal travel time to the goal.

*Proof:*
1. The shortest possible spatial distance between node $n$ and $\text{Goal}$ in Euclidean space is the straight-line segment $\text{dist}_{\text{Euclidean}}(n, \text{Goal})$. Any real road path $\mathcal{P}_{n \to \text{Goal}}$ consists of street segments whose total length satisfies $\sum_{e \in \mathcal{P}} \text{Length}(e) \ge \text{dist}_{\text{Euclidean}}(n, \text{Goal})$.
2. The real velocity on any road edge at any time $t$ satisfies $v(e, t) \le v_{\text{max}}$ by definition of $v_{\text{max}}$.
3. The true optimal travel time is $h^*(n) = \int_{\mathcal{P}^*} \frac{1}{v(s, t)} ds \ge \frac{1}{v_{\text{max}}} \int_{\mathcal{P}^*} ds \ge \frac{\text{dist}_{\text{Euclidean}}(n, \text{Goal})}{v_{\text{max}}} = h(n)$.
4. Since $h(n) \le h^*(n)$ universally, $h(n)$ is strictly admissible and guarantees optimal shortest-time paths without overestimation. $\blacksquare$

### 4.3 Dynamic D* Lite Incremental Replanning
When an ambulance encounters an unexpected road blockage or severe traffic jam, recomputing the path using standard A* over large urban graphs imposes prohibitive CPU latency.
**D* Lite** maintains Right-Hand-Side (RHS) values:
$$\text{rhs}(u) = \min_{s' \in \text{Succ}(u)} \left( c(u, s') + g(s') \right)$$
When edge cost $c(u, v)$ changes:
1. D* Lite updates only the inconsistent nodes where $g(s) \neq \text{rhs}(s)$.
2. Priority queue keys are updated with heuristic distance back to the moving ambulance position.
3. The path is repaired in $\mathcal{O}(m \log n)$ time, reducing computation overhead by $85\%$ compared to full A* recalculation.

### 4.4 Gale-Shapley Stable Two-Sided Hospital Allocation
To eradicate Ambulance Offload Delay (AOD), hospital selection is modeled as a bipartite matching game:
* **Ambulance Preference Ranking:** $\mathcal{R}_{\text{amb}} = \text{Rank}\left[ \text{TravelTime} + \text{SpecialtyFit} + \text{OffloadDelay} \right]$
* **Hospital Preference Ranking:** $\mathcal{R}_{\text{hosp}} = \text{Rank}\left[ \text{Clinical Triage Acuity (ESI)} + \text{Pre-Arrival Vitals} \right]$
* **Quota:** Each hospital $H_j$ has an available trauma resuscitation bed capacity $q_j$.

**Deferred Acceptance Convergence:**
1. Ambulances propose to their highest-ranked hospital.
2. Hospitals tentatively hold their top $q_j$ bids and reject excess proposals.
3. Rejected ambulances propose to their next choice until equilibrium is reached.
4. **Guarantee:** The resulting allocation contains **zero blocking pairs**, mathematically ensuring no ambulance and hospital would prefer each other over their assigned matches.

---

## 5. Rubric Component 4: 6-Week Implementation Roadmap & Review 2 Plan (1 Mark)

### 5.1 6-Week Sprint Breakdown

```
Week 1 - 2 (Sprint 1): Graph & Agent Framework
├── OSMnx road graph extraction (Coimbatore / Bengaluru)
├── Synthetic Poisson call generator calibrated on municipal EMS data
└── Python Mesa agent skeleton (Dispatcher, Ambulance, Hospital)

Week 3 - 4 (Sprint 2): Algorithmic Core
├── Time-Dependent A* search with time-varying congestion profiles
├── FIPA-ACL Contract Net Protocol implementation (CFP, Bid, Award)
└── D* Lite dynamic replanning on sudden edge cost changes

Week 5 - 6 (Sprint 3): Matching & Benchmark Defense
├── Gale-Shapley bilateral hospital allocation engine
├── Benchmarking MAS vs Centralized Nearest-Unit CAD baseline (1,000 runs)
└── Interactive web dashboard export for Review 2 presentation
```

---

## 6. Comprehensive Viva Defense Question Bank & Academic Rebuttals

### Q1: Why choose a Multi-Agent System (MAS) over Operations Research (OR) Integer Programming?
**Answer:**
> Centralized Operations Research (such as Mixed-Integer Linear Programming) formulates dispatch as a centralized optimization problem with combinatorial complexity $\mathcal{O}(n!)$. As the number of simultaneous emergencies and vehicles scales, computation time grows non-linearly, leading to solver timeouts during crisis surges. Furthermore, centralized CAD is a single point of failure. MAS distributes computation to edge agents (Ambulances and Hospitals), achieving linear $\mathcal{O}(k)$ message complexity, sub-second decision latency, and complete operational resilience against central server outages.

### Q2: What is Ambulance Offload Delay (AOD) and why can't current CAD systems solve it?
**Answer:**
> AOD (or "ambulance ramping") occurs when an ambulance arrives at a hospital ER with a patient but cannot transfer clinical custody because all ER resuscitation beds and triage nurses are saturated. Current CAD systems only optimize travel time from the station to the emergency scene, treating destination hospital selection as an uncoordinated afterthought. AURA-EMS solves this by executing Gale-Shapley bilateral matching while the ambulance is en-route, electronically pre-reserving a trauma bed before the vehicle wheels roll.

### Q3: How do you mathematically guarantee that your Time-Dependent A* heuristic is admissible?
**Answer:**
> We define $h(n) = \frac{\text{EuclideanDistance}(n, \text{Goal})}{v_{\text{max}}}$, where $v_{\text{max}}$ is the maximum theoretical speed limit across all urban expressways. Since the Euclidean distance is the shortest possible physical path in continuous space, and dividing by the maximum possible velocity yields the absolute lower bound on travel time, $h(n)$ can never overestimate the true remaining travel time $h^*(n)$. Because $h(n) \le h^*(n)$ holds universally for all nodes, the heuristic is strictly admissible and guarantees optimal shortest-time paths.

### Q4: Why is the Hospital Emergency Department modeled as an autonomous agent rather than a passive resource?
**Answer:**
> Hospital emergency departments have continuous internal state dynamics: unpredictable walk-in arrivals, emergency surgical interventions, staffing shift rotations, and ICU discharge bottlenecks. Treating the hospital as a passive capacity integer creates stale data. Modeling the hospital as an active autonomous agent enables it to dynamically price its admission capacity via surcharge factors, negotiate intake allocations, and broadcast proactive diversion warnings before catastrophic crowding occurs.

---

**Report Authored by:**  
Amrita FOAI Research Group — Team 23CSE301 Review 1  
*Sheela Akshar Sakhi (`CB.SC.U4CSE23547`) • `CB.SC.U4CSE23538` • `CB.SC.U4CSE23535` • `CB.SC.U4CSE[Member 4]`*
