# AURA-EMS: Viva Defense Master Guide
## Oral Examination & Examiner Cross-Examination Playbook (Review 1 — 10 Marks)
**Amrita School of Computing — 23CSE301 Foundations of Artificial Intelligence**

---

### Quick Rubrics & Marks Distribution Cheat Sheet

* **PEAS Formulation (3 Marks):** Led by **Sheela Akshar Sakhi (23547)** & Member 2 (`23538`).
* **Environment & Agent Analysis (3 Marks):** Led by Member 2 (`23538`) & Member 3 (`23535`).
* **Algorithmic Modeling & Search Strategy (3 Marks):** Led by Member 3 (`23535`) & Member 4.
* **Q&A, Plan & Presentation Mechanics (1 Mark):** All 4 Members.

---

### 10 Core Viva Defense Questions & Winning Examiner Rebuttals

#### Q1: "Why did you build a Multi-Agent System (MAS) rather than solving this with a standard Operations Research (OR) integer programming solver?"
* **Core Answer Formula:**
  > "Centralized integer linear programming suffers from combinatorial state explosion $\mathcal{O}(n!)$ during urban mass casualty incidents when dozens of calls arrive simultaneously. Moreover, centralized CAD is a single point of failure; if the central dispatch server loses connectivity, the entire municipal EMS freezes. Our MAS decentralizes dispatch auctions to edge nodes (ambulances and hospitals) using the FIPA-ACL Contract Net Protocol, scaling with linear $\mathcal{O}(k)$ message complexity and providing continuous operational resilience."
* **Keywords to Say:** *Combinatorial State Explosion $\mathcal{O}(n!)$*, *Single Point of Failure*, *Linear Scalability $\mathcal{O}(k)$*, *Edge Resilience*.

---

#### Q2: "What is Ambulance Offload Delay (AOD) or 'Ambulance Ramping', and why does traditional CAD fail to solve it?"
* **Core Answer Formula:**
  > "AOD occurs when an ambulance transports a patient to an emergency department, but cannot transfer clinical custody because all ER resuscitation beds and triage nurses are saturated. Paramedics are forced to wait in parking bays for up to 90 minutes monitoring the patient, immobilizing up to 40% of the active municipal fleet. Traditional CAD only optimizes station-to-scene travel time, treating hospital destination as an uncoordinated aftermath. We solve this by executing bilateral Gale-Shapley matching while the vehicle is en-route, pre-locking a trauma bed before the vehicle departs the scene."
* **Keywords to Say:** *Ambulance Offload Delay (AOD)*, *40% fleet immobilization*, *Bilateral Pre-Arrival Bed Lock*, *Gale-Shapley Stable Matching*.

---

#### Q3: "Walk me through your mathematical objective function. What is the role of $\gamma_i$ and $\lambda_{\text{coverage}}$?"
* **Core Answer Formula:**
  > "Our objective function is:
  > $$\mathcal{P}_{\text{dispatch}} = \sum_{i} \gamma_i \cdot (t_{\text{arrival}, i} - t_{\text{call}, i}) + \lambda_{\text{coverage}} \cdot \text{Penalty}_{\text{coverage}}$$
  > The parameter $\gamma_i$ is an exponential clinical urgency multiplier tied to the 5-level Emergency Severity Index (ESI). An ESI-1 cardiac arrest has $\gamma_1 = 10.0$, whereas an ESI-5 routine call has $\gamma_5 = 0.5$. This creates a steep penalty gradient that prevents the optimizer from choosing a closer routine call over a critical life-threatening emergency. The $\lambda_{\text{coverage}}$ term penalizes leaving an urban quadrant without any patrolling units, preventing regional fleet starvation."
* **Keywords to Say:** *Emergency Severity Index (ESI)*, *Steep Penalty Gradient*, *Regional Coverage Starvation Penalty*.

---

#### Q4: "How do you mathematically prove that your Time-Dependent A* heuristic is admissible?"
* **Core Answer Formula:**
  > "We define the heuristic as:
  > $$h(n) = \frac{\text{EuclideanDistance}(n, \text{Goal})}{v_{\text{max}}}$$
  > where $v_{\text{max}}$ is the maximum theoretical speed limit across all expressways. Because the straight-line Euclidean distance is the shortest possible physical distance between two points in continuous space, and dividing by the absolute maximum velocity yields the absolute minimum possible travel time, $h(n)$ can never exceed the true optimal remaining travel time $h^*(n)$. Because $h(n) \le h^*(n)$ holds universally for every node $n$, the heuristic is strictly admissible, guaranteeing optimal shortest-time paths without overestimation."
* **Keywords to Say:** *Euclidean Distance lower bound*, *Maximum velocity $v_{\text{max}}$*, *No overestimation $h(n) \le h^*(n)$*, *Optimality guarantee*.

---

#### Q5: "What happens if a major traffic jam or accident suddenly blocks a road while an ambulance is en-route? Do you re-run A* from scratch?"
* **Core Answer Formula:**
  > "No, re-running full A* over a large urban graph causes unacceptable CPU latency. Instead, our agents use **D* Lite**, an incremental dynamic replanning algorithm. D* Lite maintains Right-Hand-Side (RHS) values and only updates nodes whose edge costs were affected by the traffic jam, propagating cost changes incrementally. This repairs the optimal path in $\mathcal{O}(m \log n)$ time, saving over 85% computation overhead."
* **Keywords to Say:** *D* Lite Incremental Replanning*, *Right-Hand-Side (RHS) consistency*, *$\mathcal{O}(m \log n)$ repair time*.

---

#### Q6: "Why is the Hospital Emergency Department modeled as an autonomous agent rather than a passive database or resource?"
* **Core Answer Formula:**
  > "Hospital emergency departments are not static databases; they have continuous internal stochastic dynamics: unexpected walk-in arrivals, emergency surgeries, shift rotations, and delayed ICU discharges. Treating the ER as an autonomous agent allows it to actively price its intake capacity via admission surcharges, negotiate patient allocations, and proactively broadcast diversion advisories before catastrophic saturation occurs."
* **Keywords to Say:** *Internal Stochastic Dynamics*, *Dynamic Surcharge Pricing*, *Proactive Diversion Advisories*.

---

#### Q7: "Explain your classification of the EMS environment across Russell & Norvig's 7 canonical dimensions."
* **Core Answer Formula:**
  > 1. **Partially Observable:** Ambulances cannot observe distant traffic accidents or sudden hospital bed status shifts until telemetry syncs.
  > 2. **Multi-Agent:** Ambulances cooperate for city-wide life-saving, but compete for physical road right-of-way and ICU beds.
  > 3. **Stochastic:** Emergency call arrivals follow a Poisson process; traffic and clinical deterioration are probabilistic.
  > 4. **Sequential:** Today's dispatch decision directly exhausts local fleet coverage for subsequent emergencies.
  > 5. **Dynamic:** The city street traffic and patient vitals continuously evolve while the algorithm deliberates.
  > 6. **Continuous:** Coordinates, speeds, timestamps, and patient ECG signals are continuous real values.
  > 7. **Known Topology, Unknown Latent States:** Static road geometry is known via OpenStreetMap, but dynamic edge travel speeds and internal ER staffing states are latent until observed.
* **Keywords to Say:** *Partially Observable*, *Cooperative + Competitive*, *Stochastic Poisson*, *Sequential*, *Dynamic*, *Continuous*, *Known Topology with Latent Dynamics*.

---

#### Q8: "Why did you choose a Utility-Based agent architecture over a Goal-Based agent architecture?"
* **Core Answer Formula:**
  > "Goal-based agents only evaluate binary outcomes: goal achieved or goal failed. In emergency medical logistics, goals are inherently multi-attribute and conflicting. For example, rushing to the nearest hospital minimizes travel time, but that hospital may lack a specialized cardiac catheterization lab, leading to secondary patient mortality. A Utility-based BDI agent evaluates continuous trade-offs using a multi-attribute utility function:
  > $$\mathcal{U}(a) = w_{\text{time}} \cdot \frac{1}{\text{ETA}} + w_{\text{survival}} \cdot P(\text{Survival} \mid \text{Specialty}) - w_{\text{cost}} \cdot \text{CongestionCost}$$
  > This enables rational decision-making under competing objectives."
* **Keywords to Say:** *Binary Goal Limitation*, *Conflicting Objectives*, *Multi-Attribute Utility Function $\mathcal{U}(a)$*.

---

#### Q9: "How does the FIPA-ACL Contract Net Protocol (CNP) execute in your system?"
* **Core Answer Formula:**
  > "When a 911 call is verified, the Central Dispatch Coordinator broadcasts a Call For Proposals (CFP) packet containing incident coordinates and ESI triage acuity. All idle or returning ambulance agents in range calculate their Time-Dependent A* arrival time and compute a utility bid. The Dispatcher evaluates all bids and transmits a binding `ACCEPT_PROPOSAL` to the winning ambulance while sending `REJECT_PROPOSAL` to others. Simultaneously, the winning unit initiates a bilateral hospital bed reservation."
* **Keywords to Say:** *CFP Broadcast*, *TDA* Bid Calculation*, *Binding Award*, *FIPA-ACL Standard*.

---

#### Q10: "What are your specific deliverables for Review 2?"
* **Core Answer Formula:**
  > "For Review 2, our 6-week engineering roadmap will deliver:
  > 1. Ingestion of the real-world road network graph of Coimbatore or Bengaluru using OSMnx and NetworkX.
  > 2. Multi-agent execution simulator built in Python Mesa with real-time FIPA-ACL message logging.
  > 3. Benchmarking 1,000 simulated emergency incidents comparing AURA-EMS against standard centralized Nearest-Unit CAD baseline, measuring Mean Response Time, Ambulance Offload Delay, and Specialty Match Rate."
* **Keywords to Say:** *Python Mesa*, *OSMnx / NetworkX*, *1,000 incident benchmark*, *Baseline comparison*.
