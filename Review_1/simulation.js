/**
 * AURA-EMS — Premium Multi-Agent Urban Simulation Engine
 * Apple Keynote / Google I/O Level Canvas Rendering
 * 
 * Features:
 *   • Anti-aliased top-down vehicles with headlights, windows, and reflections
 *   • Ambient floating particle system (city dust / rain)
 *   • Glowing neon road network with flowing lane dividers
 *   • Smooth Bézier path trails with gradient fade
 *   • Professional HUD overlays rendered directly on canvas
 *   • Premium hospital and incident rendering with concentric halos
 *   • Helicopter with rotor motion blur
 *   • FIPA-ACL data packets as glowing orbs with comet tails
 */

class CitySimulation {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.resizeCanvas();

    this.isRunning = true;
    this.simSpeed = 1.0;
    this.timeStep = 0;
    this.frameCount = 0;

    // Theme awareness
    this.isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // Color palette (adapts to theme)
    this.palette = this.isDark ? {
      bg: '#0a0e1a',
      roadBase: '#141b2d',
      roadBorder: 'rgba(255,255,255,0.06)',
      roadCenter: 'rgba(255,255,255,0.12)',
      expressway: 'rgba(99,179,237,0.25)',
      expresswayBorder: 'rgba(99,179,237,0.5)',
      node: 'rgba(255,255,255,0.15)',
      text: '#e2e8f0',
      textMuted: '#94a3b8',
      hospitalGlow: 0.5,
      ambientParticle: 'rgba(255,255,255,0.04)',
    } : {
      bg: '#f8fafc',
      roadBase: '#e2e8f0',
      roadBorder: 'rgba(0,0,0,0.08)',
      roadCenter: 'rgba(0,0,0,0.15)',
      expressway: 'rgba(37,99,235,0.15)',
      expresswayBorder: 'rgba(37,99,235,0.35)',
      node: 'rgba(0,0,0,0.1)',
      text: '#1e293b',
      textMuted: '#64748b',
      hospitalGlow: 0.35,
      ambientParticle: 'rgba(0,0,0,0.02)',
    };

    // Simulation metrics
    this.metrics = {
      callsReceived: 24, callsDispatched: 24,
      avgResponseTime: 5.4, offloadDelay: 1.8,
      livesSaved: 22
    };

    // World Entities
    this.nodes = [];
    this.edges = [];
    this.hospitals = [];
    this.ambulances = [];
    this.civilianCars = [];
    this.incidents = [];
    this.helicopter = null;
    this.radioWaves = [];
    this.networkPackets = [];
    this.searchFrontiers = [];
    this.ambientParticles = [];
    this.selectedAgent = null;

    this.initGraph();
    this.initHospitals();
    this.initAmbulances();
    this.initCivilianTraffic();
    this.initHelicopter();
    this.initSampleIncidents();
    this.initAmbientParticles();

    window.addEventListener('resize', () => this.handleResize());
    if (window.ResizeObserver && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.canvas.parentElement);
    }
    this.setupInteractivity();

    this.lastTime = performance.now();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  updateTheme() {
    this.isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    this.palette = this.isDark ? {
      bg: '#0a0e1a', roadBase: '#141b2d', roadBorder: 'rgba(255,255,255,0.06)',
      roadCenter: 'rgba(255,255,255,0.12)', expressway: 'rgba(99,179,237,0.25)',
      expresswayBorder: 'rgba(99,179,237,0.5)', node: 'rgba(255,255,255,0.15)',
      text: '#e2e8f0', textMuted: '#94a3b8', hospitalGlow: 0.5,
      ambientParticle: 'rgba(255,255,255,0.04)',
    } : {
      bg: '#f8fafc', roadBase: '#e2e8f0', roadBorder: 'rgba(0,0,0,0.08)',
      roadCenter: 'rgba(0,0,0,0.15)', expressway: 'rgba(37,99,235,0.15)',
      expresswayBorder: 'rgba(37,99,235,0.35)', node: 'rgba(0,0,0,0.1)',
      text: '#1e293b', textMuted: '#64748b', hospitalGlow: 0.35,
      ambientParticle: 'rgba(0,0,0,0.02)',
    };
  }

  resizeCanvas() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.floor(rect.width) || 860;
    const h = Math.floor(rect.height) || 520;
    this.width = Math.max(400, w);
    this.height = Math.max(420, h);
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  handleResize() {
    const oldW = this.width, oldH = this.height;
    this.resizeCanvas();
    if (this.width === oldW && this.height === oldH) return;
    this.initGraph();
    this.initHospitals();
    for (const amb of this.ambulances) {
      if (amb.nodeId != null && this.nodes[amb.nodeId]) {
        amb.x = this.nodes[amb.nodeId].x;
        amb.y = this.nodes[amb.nodeId].y;
      }
    }
  }

  // ── GRAPH ──────────────────────────────────────────────
  initGraph() {
    this.nodes = []; this.edges = [];
    const cols = 7, rows = 5, px = 80, py = 65;
    const cw = (this.width - px * 2) / (cols - 1);
    const ch = (this.height - py * 2) / (rows - 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.nodes.push({ id: r * cols + c, r, c, x: px + c * cw, y: py + r * ch });
      }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const u = r * cols + c;
      if (c < cols - 1) this.addEdge(u, r * cols + c + 1, false);
      if (r < rows - 1) this.addEdge(u, (r + 1) * cols + c, false);
    }
    this.addEdge(1, 1 * 7 + 3, true);
    this.addEdge(3 * 7 + 3, 4 * 7 + 5, true);
  }

  addEdge(u, v, express = false) {
    const a = this.nodes[u], b = this.nodes[v];
    this.edges.push({
      u, v, isExpressway: express,
      baseLength: Math.hypot(a.x - b.x, a.y - b.y),
      speedLimit: express ? 3.8 : 2.4,
      congestion: 1.0, isCongested: false, flowOffset: 0
    });
  }

  // ── AGENTS ─────────────────────────────────────────────
  initHospitals() {
    const defs = [
      { id: 'H1', name: 'Metro Trauma', spec: 'Level 1 Trauma', cathLab: true, nodeId: 3, cap: 16, occ: 11, color: '#10b981' },
      { id: 'H2', name: 'Apex Cardiac', spec: 'STEMI Cath Lab', cathLab: true, nodeId: 20, cap: 12, occ: 7, color: '#3b82f6' },
      { id: 'H3', name: 'St. Jude ER', spec: 'General Emergency', cathLab: false, nodeId: 30, cap: 18, occ: 15, color: '#f59e0b' },
      { id: 'H4', name: 'Valley Care', spec: 'Pediatric Acute', cathLab: false, nodeId: 14, cap: 14, occ: 5, color: '#8b5cf6' },
    ];
    this.hospitals = defs.map(d => ({ ...d, surcharge: 1.0, offloadQueue: d.occ > d.cap * 0.85 ? 1 : 0 }));
  }

  initAmbulances() {
    const defs = [
      { callSign: 'Rescue Alpha', baseNodeId: 8, nodeId: 8, stationName: 'Sector 1 Hub', color: '#06b6d4' },
      { callSign: 'Medic Bravo', baseNodeId: 25, nodeId: 25, stationName: 'South EMS Bay', color: '#3b82f6' },
      { callSign: 'Rapid Charlie', baseNodeId: 29, nodeId: 29, stationName: 'East Outpost', color: '#f59e0b' },
      { callSign: 'Delta LifeLine', baseNodeId: 5, nodeId: 5, stationName: 'North Station', color: '#8b5cf6' },
    ];
    this.ambulances = defs.map((d, i) => ({
      id: `AMB-${101 + i}`, ...d,
      x: this.nodes[d.nodeId].x, y: this.nodes[d.nodeId].y, angle: 0,
      status: 'STANDBY', assignedIncident: null, targetHospital: null,
      speed: 2.6 + i * 0.15,
      path: [], pathProgress: 0, sirenPhase: 0,
      trail: []
    }));
    this.selectedAgent = this.ambulances[0];
  }

  initCivilianTraffic() {
    this.civilianCars = [];
    const colors = ['#64748b', '#94a3b8', '#cbd5e1', '#475569', '#e2e8f0', '#eab308'];
    for (let i = 0; i < 20; i++) {
      const edge = this.edges[Math.floor(Math.random() * this.edges.length)];
      const p = Math.random();
      const a = this.nodes[edge.u], b = this.nodes[edge.v];
      this.civilianCars.push({
        edge, forward: Math.random() > 0.5, progress: p,
        speed: 0.002 + Math.random() * 0.003,
        color: colors[i % colors.length],
        x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p,
        angle: 0, isYielding: false, yieldBlink: 0
      });
    }
  }

  initHelicopter() {
    const n = this.nodes[3]; // Metro Trauma Helipad
    this.helicopter = {
      x: n.x, y: n.y, baseNodeId: 3, targetX: n.x, targetY: n.y,
      speed: 2.2, rotorAngle: 0, callSign: 'MEDEVAC 1',
      status: 'STANDBY', assignedIncident: null
    };
  }

  initSampleIncidents() {
    this.incidents = [];
    this.log('[SYSTEM] Emergency Fleet online. All 4 ambulances stationed on STANDBY at EMS bays.');
    this.log('[STANDBY] Units will stay stationed until a 911 call is placed (use toolbar buttons or click nodes).');
  }

  initAmbientParticles() {
    this.ambientParticles = [];
    for (let i = 0; i < 50; i++) {
      this.ambientParticles.push({
        x: Math.random() * this.width, y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        size: 1 + Math.random() * 2.5, opacity: 0.15 + Math.random() * 0.25
      });
    }
  }

  // ── INTERACTIVITY ──────────────────────────────────────
  setupInteractivity() {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;

      for (const amb of this.ambulances) {
        if (Math.hypot(amb.x - cx, amb.y - cy) < 28) {
          this.selectedAgent = amb;
          this.emitWave(amb.x, amb.y, amb.color);
          this.log(`[INSPECT] Focused on ${amb.callSign}`);
          this.updateInspectorHUD(amb);
          return;
        }
      }

      for (const h of this.hospitals) {
        const n = this.nodes[h.nodeId];
        if (Math.hypot(n.x - cx, n.y - cy) < 34) {
          this.selectedAgent = h;
          this.emitWave(n.x, n.y, h.color);
          this.log(`[ER INSPECT] ${h.name} — ${h.occ}/${h.cap} beds`);
          return;
        }
      }

      for (const edge of this.edges) {
        const u = this.nodes[edge.u], v = this.nodes[edge.v];
        if (this.ptSegDist(cx, cy, u.x, u.y, v.x, v.y) < 14) {
          edge.isCongested = !edge.isCongested;
          edge.congestion = edge.isCongested ? 3.5 : 1.0;
          this.log(`[TRAFFIC] Road ${edge.isCongested ? 'JAMMED' : 'CLEARED'}. D* Lite replanning.`);
          this.replanAll();
          return;
        }
      }

      const near = this.closestNode(cx, cy);
      if (near) this.spawnIncident(near.id, Math.random() < 0.5 ? 1 : 2);
    });
  }

  ptSegDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, lenSq = dx * dx + dy * dy;
    if (!lenSq) return Math.hypot(px - x1, py - y1);
    let t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  closestNode(x, y) {
    let best = null, d = Infinity;
    for (const n of this.nodes) { const dd = Math.hypot(n.x - x, n.y - y); if (dd < d) { d = dd; best = n; } }
    return best;
  }

  // ── MULTI-AGENT PROTOCOLS ──────────────────────────────
  spawnIncident(nodeId, esi = 1, condition) {
    const node = this.nodes[nodeId] || this.nodes[17];
    const conds = { 1: ['Cardiac Arrest (VF)', 'Tension Pneumothorax'], 2: ['Acute Stroke', 'STEMI Heart Attack'], 3: ['Compound Fracture'] };
    const cond = condition || (conds[esi] || conds[1])[Math.floor(Math.random() * 2)];
    const inc = { id: `INC-${Math.floor(1000 + Math.random() * 9000)}`, nodeId: node.id, x: node.x, y: node.y, esi, condition: cond, status: 'PENDING', pulse: 0 };
    this.incidents.push(inc);
    this.metrics.callsReceived++;
    this.log(`[911] ${inc.id}: ${cond} (ESI-${esi})`);
    this.emitWave(inc.x, inc.y, esi === 1 ? '#ef4444' : '#f59e0b');
    setTimeout(() => this.runCNP(inc), 500 / this.simSpeed);
  }

  runCNP(inc) {
    this.log(`[CNP] 911 Call received (${inc.condition}, ESI-${inc.esi}). Dispatcher broadcasting CFP...`);
    const bids = [];
    for (const amb of this.ambulances) {
      this.emitPacket(this.width / 2, this.height / 2, amb.x, amb.y, '#06b6d4', 'CFP');
      if (amb.status === 'STANDBY' || amb.status === 'RETURNING') {
        const path = this.astar(amb.nodeId, inc.nodeId);
        const eta = this.pathCost(path);
        const gamma = inc.esi === 1 ? 3 : 1.5;
        bids.push({ amb, path, eta, utility: -(gamma * eta) });
        setTimeout(() => this.emitPacket(amb.x, amb.y, this.width / 2, this.height / 2, amb.color, `BID ${eta.toFixed(1)}m`), 250);
      }
    }
    setTimeout(() => {
      if (!bids.length) { this.log('[CNP] No ambulances available on standby.'); return; }
      bids.sort((a, b) => b.utility - a.utility);
      const w = bids[0];
      w.amb.status = 'DISPATCHED'; w.amb.assignedIncident = inc;
      w.amb.path = w.path; w.amb.pathProgress = 0; inc.status = 'ASSIGNED';
      this.log(`[CNP AWARD] ${w.amb.callSign} awarded contract (ETA ${w.eta.toFixed(1)} min). Units deploying.`);
      this.emitPacket(this.width / 2, this.height / 2, w.amb.x, w.amb.y, '#10b981', 'ACCEPT');
      this.matchHospital(w.amb, inc);
      this.updateHUD();
      this.updateInspectorHUD(this.selectedAgent);
    }, 600);
  }

  matchHospital(amb, inc) {
    let candidates = this.hospitals.slice();
    if (inc.esi === 1 && inc.condition.includes('Cardiac')) candidates = candidates.filter(h => h.cathLab);
    candidates.sort((a, b) => {
      const da = Math.hypot(this.nodes[a.nodeId].x - amb.x, this.nodes[a.nodeId].y - amb.y);
      const db = Math.hypot(this.nodes[b.nodeId].x - amb.x, this.nodes[b.nodeId].y - amb.y);
      return (da * a.occ / a.cap * a.surcharge) - (db * b.occ / b.cap * b.surcharge);
    });
    amb.targetHospital = candidates[0];
    const hn = this.nodes[candidates[0].nodeId];
    this.emitPacket(amb.x, amb.y, hn.x, hn.y, candidates[0].color, 'BED LOCK');
    this.log(`[MATCH] ${candidates[0].name} bed pre-reserved.`);
  }

  replanAll() {
    for (const amb of this.ambulances) {
      if ((amb.status === 'DISPATCHED' || amb.status === 'TRANSPORT') && amb.path.length > 1) {
        const dest = amb.status === 'DISPATCHED' ? amb.assignedIncident?.nodeId : amb.targetHospital?.nodeId;
        if (dest != null && this.nodes[dest]) {
          amb.path = this.astar(amb.nodeId, dest); amb.pathProgress = 0;
          this.log(`[D* LITE] ${amb.callSign} replanned detour.`);
          this.emitWave(amb.x, amb.y, '#f59e0b', 70);
        }
      }
    }
  }

  // ── A* SEARCH ──────────────────────────────────────────
  astar(start, goal) {
    if (start == null || goal == null || !this.nodes[start] || !this.nodes[goal]) return [];
    if (start === goal) return [start];
    const open = [start], cf = new Map(), g = new Map(), f = new Map();
    this.nodes.forEach(n => { g.set(n.id, Infinity); f.set(n.id, Infinity); });
    g.set(start, 0);
    f.set(start, this.heuristic(this.nodes[start], this.nodes[goal]));
    while (open.length) {
      open.sort((a, b) => f.get(a) - f.get(b));
      const cur = open.shift();
      if (cur === goal) { const p = [cur]; let c = cur; while (cf.has(c)) { c = cf.get(c); p.unshift(c); } return p; }
      for (const nb of this.neighbors(cur)) {
        const cost = (nb.edge.baseLength / (nb.edge.speedLimit * 1.5)) * nb.edge.congestion;
        const tg = g.get(cur) + cost;
        if (tg < g.get(nb.id)) {
          cf.set(nb.id, cur); g.set(nb.id, tg);
          f.set(nb.id, tg + this.heuristic(this.nodes[nb.id], this.nodes[goal]));
          if (!open.includes(nb.id)) open.push(nb.id);
        }
      }
    }
    return [start, goal];
  }

  heuristic(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) / 4.0; }

  neighbors(id) {
    const r = [];
    this.edges.forEach(e => {
      if (e.u === id) r.push({ id: e.v, edge: e });
      else if (e.v === id) r.push({ id: e.u, edge: e });
    });
    return r;
  }

  pathCost(path) {
    if (!path || path.length < 2) return 0.5;
    let c = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const e = this.edges.find(e => (e.u === path[i] && e.v === path[i + 1]) || (e.u === path[i + 1] && e.v === path[i]));
      if (e) c += (e.baseLength / (e.speedLimit * 60)) * e.congestion;
    }
    return Math.max(1.5, c);
  }

  // ── UPDATE LOOP ────────────────────────────────────────
  update(dt) {
    this.timeStep += dt * this.simSpeed;
    this.frameCount++;

    // Edge flow animation
    this.edges.forEach(e => { e.flowOffset = (e.flowOffset + (e.isCongested ? 0.3 : 1.0) * this.simSpeed) % 16; });

    // Waves
    for (let i = this.radioWaves.length - 1; i >= 0; i--) {
      this.radioWaves[i].radius += 6 * this.simSpeed;
      if (this.radioWaves[i].radius > this.radioWaves[i].max) this.radioWaves.splice(i, 1);
    }

    // Packets
    for (let i = this.networkPackets.length - 1; i >= 0; i--) {
      this.networkPackets[i].progress += 0.04 * this.simSpeed;
      if (this.networkPackets[i].progress >= 1) this.networkPackets.splice(i, 1);
    }

    // Search waves
    for (let i = this.searchFrontiers.length - 1; i >= 0; i--) {
      this.searchFrontiers[i].progress += 0.04 * this.simSpeed;
      if (this.searchFrontiers[i].progress >= 1) this.searchFrontiers.splice(i, 1);
    }

    // Ambient particles (gentle float)
    this.ambientParticles.forEach(p => {
      p.x += p.vx * this.simSpeed; p.y += p.vy * this.simSpeed;
      if (p.x < 0) p.x = this.width; if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height; if (p.y > this.height) p.y = 0;
    });

    this.updateCars();
    this.updateHeli();
    this.updateAmbs();
    this.incidents.forEach(inc => { inc.pulse = (inc.pulse + 0.5 * this.simSpeed) % 30; });
  }

  updateAmbs() {
    for (const a of this.ambulances) {
      a.sirenPhase = (a.sirenPhase + 0.2 * this.simSpeed) % (Math.PI * 2);

      // In STANDBY: remain completely still at station!
      if (a.status === 'STANDBY') {
        continue;
      }

      if (a.path.length > 1) {
        const cur = a.path[a.pathProgress], nxt = a.path[a.pathProgress + 1];
        if (cur !== undefined && nxt !== undefined) {
          const nn = this.nodes[nxt];
          const dx = nn.x - a.x, dy = nn.y - a.y, dist = Math.hypot(dx, dy);
          a.angle = Math.atan2(dy, dx);
          const spd = (a.status === 'RETURNING' ? a.speed * 0.75 : a.speed) * this.simSpeed;
          if (dist < spd * 1.5) {
            a.x = nn.x; a.y = nn.y; a.nodeId = nxt; a.pathProgress++;
            if (a.pathProgress >= a.path.length - 1) {
              if (a.status === 'DISPATCHED') this.arriveScene(a);
              else if (a.status === 'TRANSPORT') this.arriveHospital(a);
              else if (a.status === 'RETURNING') {
                a.status = 'STANDBY';
                a.path = []; a.pathProgress = 0; a.trail = [];
                this.log(`[STANDBY] ${a.callSign} parked at ${a.stationName}. Ready for calls.`);
                this.updateHUD();
                this.updateInspectorHUD(this.selectedAgent);
              }
            }
          } else {
            a.x += (dx / dist) * spd; a.y += (dy / dist) * spd;
          }
        }
      }

      // Motion trail (only when responding or transporting)
      if (a.status === 'DISPATCHED' || a.status === 'TRANSPORT') {
        a.trail.push({ x: a.x, y: a.y, age: 0 });
        if (a.trail.length > 25) a.trail.shift();
      } else {
        if (a.trail.length) a.trail.shift();
      }
      a.trail.forEach(t => t.age++);
    }
  }

  updateCars() {
    for (const c of this.civilianCars) {
      const u = this.nodes[c.edge.u], v = this.nodes[c.edge.v];
      let near = false;
      for (const a of this.ambulances) {
        if ((a.status === 'DISPATCHED' || a.status === 'TRANSPORT') && Math.hypot(c.x - a.x, c.y - a.y) < 70) {
          near = true; break;
        }
      }
      c.isYielding = near;
      if (near) c.yieldBlink = (c.yieldBlink + 0.3 * this.simSpeed) % (Math.PI * 2);
      const spd = (near ? c.speed * 0.2 : c.speed) * this.simSpeed;
      c.progress += c.forward ? spd : -spd;
      if (c.progress > 1 || c.progress < 0) {
        c.progress = c.progress > 1 ? 0 : 1;
        const pool = this.edges.filter(e => e.u === (c.forward ? c.edge.v : c.edge.u) || e.v === (c.forward ? c.edge.v : c.edge.u));
        if (pool.length) { c.edge = pool[Math.floor(Math.random() * pool.length)]; c.forward = Math.random() > 0.5; }
      }
      const p = Math.max(0, Math.min(1, c.progress));
      c.x = u.x + (v.x - u.x) * p; c.y = u.y + (v.y - u.y) * p;
      c.angle = Math.atan2(v.y - u.y, v.x - u.x) * (c.forward ? 1 : -1);
    }
  }

  updateHeli() {
    if (!this.helicopter) return;
    const h = this.helicopter;
    if (h.status === 'STANDBY') {
      h.rotorAngle = 0;
      return;
    }
    h.rotorAngle = (h.rotorAngle + 0.7 * this.simSpeed) % (Math.PI * 2);
    const dx = h.targetX - h.x, dy = h.targetY - h.y, d = Math.hypot(dx, dy);
    if (d < 8) {
      if (h.status === 'RETURNING') {
        h.status = 'STANDBY';
        h.x = h.targetX; h.y = h.targetY;
        this.log('[MEDEVAC] Helicopter safely landed at Metro Trauma helipad. STANDBY.');
      } else if (h.status === 'AIRBORNE') {
        h.status = 'RETURNING';
        const h1 = this.nodes[3];
        h.targetX = h1.x; h.targetY = h1.y;
        this.log('[MEDEVAC] Critical casualty secured. Returning to Metro Trauma helipad.');
      }
    } else {
      h.x += (dx / d) * h.speed * this.simSpeed;
      h.y += (dy / d) * h.speed * this.simSpeed;
    }
  }

  dispatchHeli(targetNodeId) {
    if (!this.helicopter) return;
    const tn = this.nodes[targetNodeId] || this.nodes[17];
    this.helicopter.status = 'AIRBORNE';
    this.helicopter.targetX = tn.x;
    this.helicopter.targetY = tn.y;
    this.log('[MEDEVAC] Air ambulance launched from helipad → en route to scene.');
    this.emitWave(this.helicopter.x, this.helicopter.y, '#38bdf8', 120);
  }

  arriveScene(a) {
    const inc = a.assignedIncident; if (!inc) return;
    a.status = 'ON_SCENE'; inc.status = 'ON_SCENE';
    this.log(`[SCENE] ${a.callSign} arrived on scene — paramedics stabilizing patient.`);
    this.updateInspectorHUD(this.selectedAgent);
    setTimeout(() => {
      if (a.targetHospital) {
        a.status = 'TRANSPORT'; inc.status = 'TRANSPORTING';
        a.path = this.astar(a.nodeId, a.targetHospital.nodeId); a.pathProgress = 0;
        this.log(`[TRANSPORT] ${a.callSign} en route to ${a.targetHospital.name} (Code 3).`);
        this.updateInspectorHUD(this.selectedAgent);
      }
    }, 1400 / this.simSpeed);
  }

  arriveHospital(a) {
    if (a.assignedIncident) a.assignedIncident.status = 'RESOLVED';
    this.metrics.livesSaved++;
    this.log(`[HANDOVER] ${a.callSign} admitted patient at ${a.targetHospital.name}. Care transfer complete.`);
    this.updateHUD();
    setTimeout(() => {
      a.status = 'RETURNING'; a.assignedIncident = null; a.targetHospital = null;
      a.path = this.astar(a.nodeId, a.baseNodeId); a.pathProgress = 0;
      this.log(`[RTB] ${a.callSign} returning to station: ${a.stationName}.`);
      this.updateHUD();
      this.updateInspectorHUD(this.selectedAgent);
    }, 1200 / this.simSpeed);
  }

  emitWave(x, y, color, max = 120) { this.radioWaves.push({ x, y, radius: 4, max, color }); }
  emitPacket(x1, y1, x2, y2, color, label) { this.networkPackets.push({ x1, y1, x2, y2, progress: 0, color, label }); }

  // ── RENDER ─────────────────────────────────────────────
  render() {
    const ctx = this.ctx, w = this.width, h = this.height, P = this.palette;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, w, h);

    // Ambient particles
    this.ambientParticles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = P.ambientParticle;
      ctx.globalAlpha = p.opacity;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    this.drawRoads(ctx, P);
    this.drawStations(ctx, P);
    this.drawSearchWaves(ctx);
    this.drawAmbPaths(ctx);
    this.drawCars(ctx);
    this.drawIntersections(ctx, P);
    this.drawHospitals(ctx, P);
    this.drawIncidents(ctx);
    this.drawAmbTrails(ctx);
    this.drawAmbs(ctx);
    this.drawHeli(ctx);
    this.drawPackets(ctx);
    this.drawWaves(ctx);
    this.drawLockOn(ctx);
  }

  drawRoads(ctx, P) {
    for (const e of this.edges) {
      const u = this.nodes[e.u], v = this.nodes[e.v];

      // Asphalt
      ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y);
      ctx.strokeStyle = P.roadBase; ctx.lineWidth = e.isExpressway ? 16 : 10;
      ctx.lineCap = 'round'; ctx.stroke();

      // Border glow
      ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y);
      if (e.isCongested) {
        ctx.strokeStyle = 'rgba(239,68,68,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
      } else if (e.isExpressway) {
        ctx.strokeStyle = P.expresswayBorder; ctx.lineWidth = 2; ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = P.roadBorder; ctx.lineWidth = 1; ctx.setLineDash([]);
      }
      ctx.stroke(); ctx.setLineDash([]);

      // Flowing center divider
      ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y);
      ctx.strokeStyle = e.isCongested ? 'rgba(239,68,68,0.4)' : P.roadCenter;
      ctx.lineWidth = 1; ctx.lineDashOffset = -e.flowOffset; ctx.setLineDash([3, 5]);
      ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
  }

  drawSearchWaves(ctx) {
    for (const sf of this.searchFrontiers) {
      const r = sf.progress * sf.maxR;
      ctx.beginPath(); ctx.arc(sf.sx, sf.sy, r, 0, Math.PI * 2);
      const a = Math.max(0, 1 - sf.progress) * 0.35;
      ctx.strokeStyle = `rgba(6,182,212,${a})`; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  drawAmbPaths(ctx) {
    for (const a of this.ambulances) {
      if (!a.path || a.path.length < 2 || a.status === 'STANDBY') continue;
      ctx.beginPath();
      for (let i = a.pathProgress; i < a.path.length; i++) {
        const n = this.nodes[a.path[i]];
        if (n) { i === a.pathProgress ? ctx.moveTo(a.x, a.y) : ctx.lineTo(n.x, n.y); }
      }
      ctx.strokeStyle = a.status === 'TRANSPORT' ? 'rgba(16,185,129,0.6)' : 'rgba(6,182,212,0.6)';
      ctx.lineWidth = 2.5; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  drawCars(ctx) {
    for (const c of this.civilianCars) {
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
      // Body
      ctx.fillStyle = c.color;
      this.roundRect(ctx, -6, -3.5, 12, 7, 2); ctx.fill();
      // Windshield
      ctx.fillStyle = this.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)';
      ctx.fillRect(-1, -2.5, 4, 5);
      // Headlights
      ctx.fillStyle = 'rgba(254,240,138,0.5)';
      ctx.fillRect(6, -2.5, 1.5, 1.5); ctx.fillRect(6, 1, 1.5, 1.5);
      // Taillights
      ctx.fillStyle = 'rgba(239,68,68,0.5)';
      ctx.fillRect(-7, -2.5, 1.5, 1.5); ctx.fillRect(-7, 1, 1.5, 1.5);
      // Hazard blink
      if (c.isYielding && Math.sin(c.yieldBlink) > 0) {
        ctx.fillStyle = 'rgba(245,158,11,0.7)';
        ctx.beginPath(); ctx.arc(7, -4, 2, 0, Math.PI * 2); ctx.arc(7, 4, 2, 0, Math.PI * 2);
        ctx.arc(-7, -4, 2, 0, Math.PI * 2); ctx.arc(-7, 4, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawIntersections(ctx, P) {
    for (const n of this.nodes) {
      ctx.beginPath(); ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = P.node; ctx.fill();
    }
  }

  drawHospitals(ctx, P) {
    for (const h of this.hospitals) {
      const n = this.nodes[h.nodeId]; if (!n) continue;
      const glow = P.hospitalGlow;

      // Outer halo ring
      const hc = this.hexToRgba(h.color, glow);
      const gc = this.hexToRgba(h.color, 0);
      const g2 = ctx.createRadialGradient(n.x, n.y, 16, n.x, n.y, 42);
      g2.addColorStop(0, hc); g2.addColorStop(1, gc);
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(n.x, n.y, 42, 0, Math.PI * 2); ctx.fill();

      // Hospital body
      ctx.beginPath(); ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = this.isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = h.color; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();

      // Cross icon
      ctx.fillStyle = h.color; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🏥', n.x, n.y);

      // Name
      ctx.font = `600 10px "Outfit", system-ui`; ctx.fillStyle = P.text; ctx.fillText(h.name, n.x, n.y - 30);

      // Capacity bar
      const bw = 38, bh = 4, ratio = h.occ / h.cap;
      ctx.fillStyle = this.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
      this.roundRect(ctx, n.x - bw / 2, n.y + 28, bw, bh, 2); ctx.fill();
      ctx.fillStyle = ratio > 0.85 ? '#ef4444' : h.color;
      this.roundRect(ctx, n.x - bw / 2, n.y + 28, bw * Math.min(1, ratio), bh, 2); ctx.fill();

      ctx.font = '500 8px "JetBrains Mono", monospace'; ctx.fillStyle = P.textMuted;
      ctx.fillText(`${h.occ}/${h.cap}`, n.x, n.y + 40);
    }
  }

  drawIncidents(ctx) {
    for (const inc of this.incidents) {
      if (inc.status === 'RESOLVED') continue;
      const c = inc.esi === 1 ? [239, 68, 68] : [245, 158, 11];

      // Expanding ring
      ctx.beginPath(); ctx.arc(inc.x, inc.y, 12 + inc.pulse, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.5 - inc.pulse / 60})`;
      ctx.lineWidth = 1.5; ctx.stroke();

      // Second ring
      ctx.beginPath(); ctx.arc(inc.x, inc.y, 6 + inc.pulse * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.3)`; ctx.lineWidth = 1; ctx.stroke();

      // Core
      ctx.beginPath(); ctx.arc(inc.x, inc.y, 7, 0, Math.PI * 2);
      const cGrad = ctx.createRadialGradient(inc.x, inc.y, 0, inc.x, inc.y, 7);
      cGrad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`);
      cGrad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0.6)`);
      ctx.fillStyle = cGrad; ctx.fill();

      ctx.font = 'bold 9px "JetBrains Mono"'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(`ESI-${inc.esi}`, inc.x, inc.y - 14);
    }
  }

  drawAmbTrails(ctx) {
    for (const a of this.ambulances) {
      if (a.trail.length < 2) continue;
      for (let i = 1; i < a.trail.length; i++) {
        const t = a.trail[i], prev = a.trail[i - 1];
        const alpha = Math.max(0, 0.5 - t.age / 60);
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = this.hexToRgba(a.color, alpha); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
      }
    }
  }

  drawStations(ctx, P) {
    for (const amb of this.ambulances) {
      const n = this.nodes[amb.baseNodeId];
      if (!n) continue;
      ctx.save();
      ctx.strokeStyle = this.hexToRgba(amb.color, 0.4);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      this.roundRect(ctx, n.x - 20, n.y - 14, 40, 28, 4);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = this.hexToRgba(amb.color, 0.07);
      this.roundRect(ctx, n.x - 20, n.y - 14, 40, 28, 4);
      ctx.fill();

      ctx.font = 'bold 7px "JetBrains Mono"';
      ctx.fillStyle = this.hexToRgba(amb.color, 0.85);
      ctx.textAlign = 'center';
      ctx.fillText(`EMS BAY`, n.x, n.y - 18);
      ctx.restore();
    }
  }

  drawAmbs(ctx) {
    for (const a of this.ambulances) {
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.angle);

      // Headlight beam (only when responding or returning)
      const isResponding = a.status === 'DISPATCHED' || a.status === 'TRANSPORT' || a.status === 'RETURNING';
      if (isResponding) {
        const hlg = ctx.createRadialGradient(12, 0, 2, 40, 0, 30);
        hlg.addColorStop(0, 'rgba(254,240,138,0.35)'); hlg.addColorStop(1, 'rgba(254,240,138,0)');
        ctx.fillStyle = hlg; ctx.beginPath();
        ctx.moveTo(10, -3); ctx.lineTo(45, -16); ctx.lineTo(45, 16); ctx.lineTo(10, 3);
        ctx.closePath(); ctx.fill();
      }

      // Siren glow (only on active emergency response)
      if (a.status === 'DISPATCHED' || a.status === 'TRANSPORT') {
        const isRed = Math.sin(a.sirenPhase) > 0;
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fillStyle = isRed ? 'rgba(239,68,68,0.25)' : 'rgba(6,182,212,0.25)'; ctx.fill();
      }

      // Body — white rounded rectangle
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = a.color; ctx.lineWidth = 1.5;
      this.roundRect(ctx, -12, -7, 24, 14, 3); ctx.fill(); ctx.stroke();

      // Windshield
      ctx.fillStyle = this.isDark ? '#1e293b' : '#334155';
      ctx.fillRect(3, -5, 3, 10);

      // Battenburg markings
      ctx.fillStyle = a.color;
      ctx.fillRect(-9, -7, 4, 3); ctx.fillRect(-5, -7, 4, 3);
      ctx.fillRect(-9, 4, 4, 3); ctx.fillRect(-5, 4, 4, 3);

      // Emergency lightbar
      if (a.status === 'DISPATCHED' || a.status === 'TRANSPORT') {
        const s1 = Math.sin(a.sirenPhase) > 0, s2 = !s1;
        ctx.fillStyle = s1 ? '#ef4444' : '#06b6d4'; ctx.fillRect(-1, -4, 3, 2.5);
        ctx.fillStyle = s2 ? '#ef4444' : '#06b6d4'; ctx.fillRect(-1, 1.5, 3, 2.5);
      } else {
        ctx.fillStyle = '#94a3b8'; ctx.fillRect(-1, -4, 3, 2.5); ctx.fillRect(-1, 1.5, 3, 2.5);
      }

      ctx.restore();

      // Vehicle Call Sign
      ctx.font = `600 9px "Outfit", system-ui`; ctx.fillStyle = this.palette.text;
      ctx.textAlign = 'center'; ctx.fillText(a.callSign, a.x, a.y - 16);

      // Status indicator badge
      ctx.font = '600 7px "JetBrains Mono"';
      if (a.status === 'STANDBY') {
        ctx.fillStyle = '#10b981';
        ctx.fillText('● STANDBY', a.x, a.y + 20);
      } else if (a.status === 'DISPATCHED') {
        ctx.fillStyle = '#ef4444';
        ctx.fillText('⚡ DISPATCHED', a.x, a.y + 20);
      } else if (a.status === 'ON_SCENE') {
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('🩺 ON SCENE', a.x, a.y + 20);
      } else if (a.status === 'TRANSPORT') {
        ctx.fillStyle = '#06b6d4';
        ctx.fillText('🚨 TRANSPORT', a.x, a.y + 20);
      } else if (a.status === 'RETURNING') {
        ctx.fillStyle = '#8b5cf6';
        ctx.fillText('↩ RETURNING', a.x, a.y + 20);
      }
    }
  }

  drawHeli(ctx) {
    if (!this.helicopter) return;
    const h = this.helicopter;

    // Shadow
    ctx.beginPath(); ctx.ellipse(h.x + 8, h.y + 20, 14, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();

    ctx.save(); ctx.translate(h.x, h.y);
    // Fuselage
    ctx.fillStyle = '#0284c7'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Tail
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-22, 0); ctx.lineWidth = 2.5; ctx.stroke();
    // Rotors (motion blur)
    ctx.save(); ctx.rotate(h.rotorAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(24, 0); ctx.moveTo(0, -24); ctx.lineTo(0, 24); ctx.stroke();
    ctx.restore();
    ctx.restore();

    ctx.font = 'bold 7px "JetBrains Mono"'; ctx.fillStyle = '#38bdf8'; ctx.textAlign = 'center';
    ctx.fillText('🚁 ' + h.callSign, h.x, h.y - 16);
  }

  drawPackets(ctx) {
    for (const p of this.networkPackets) {
      const cx = p.x1 + (p.x2 - p.x1) * p.progress;
      const cy = p.y1 + (p.y2 - p.y1) * p.progress;

      // Comet trail
      const prevX = p.x1 + (p.x2 - p.x1) * Math.max(0, p.progress - 0.08);
      const prevY = p.y1 + (p.y2 - p.y1) * Math.max(0, p.progress - 0.08);
      ctx.beginPath(); ctx.moveTo(prevX, prevY); ctx.lineTo(cx, cy);
      ctx.strokeStyle = this.hexToRgba(p.color, 0.4); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();

      // Orb
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10; ctx.fill();
      ctx.shadowBlur = 0;

      ctx.font = 'bold 7px "JetBrains Mono"'; ctx.fillStyle = this.palette.text; ctx.textAlign = 'center';
      ctx.fillText(p.label, cx, cy - 8);
    }
  }

  drawWaves(ctx) {
    for (const w of this.radioWaves) {
      ctx.beginPath(); ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      const a = Math.max(0, 1 - w.radius / w.max) * 0.45;
      ctx.strokeStyle = this.hexToRgba(w.color, a); ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  drawLockOn(ctx) {
    if (!this.selectedAgent) return;
    const sa = this.selectedAgent;
    const x = sa.x ?? this.nodes[sa.nodeId]?.x;
    const y = sa.y ?? this.nodes[sa.nodeId]?.y;
    if (x == null || y == null) return;

    ctx.save(); ctx.translate(x, y); ctx.rotate(this.timeStep * 0.6);
    ctx.strokeStyle = this.hexToRgba('#06b6d4', 0.5); ctx.lineWidth = 1.5;

    // Corner brackets
    const s = 28;
    ctx.beginPath();
    ctx.moveTo(-s, -s + 6); ctx.lineTo(-s, -s); ctx.lineTo(-s + 6, -s);
    ctx.moveTo(s - 6, -s); ctx.lineTo(s, -s); ctx.lineTo(s, -s + 6);
    ctx.moveTo(s, s - 6); ctx.lineTo(s, s); ctx.lineTo(s - 6, s);
    ctx.moveTo(-s + 6, s); ctx.lineTo(-s, s); ctx.lineTo(-s, s - 6);
    ctx.stroke();
    ctx.restore();
  }

  // ── UTILITIES ──────────────────────────────────────────
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  hexToRgba(hex, a) {
    if (!hex) return `rgba(255,255,255,${a})`;
    if (typeof hex === 'string' && hex.startsWith('rgb')) return hex.replace(/[\d\.]+\)$/g, `${a})`);
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${a})`;
  }

  log(msg) {
    const el = document.getElementById('simConsoleLogs');
    if (!el) return;
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    const d = document.createElement('div');
    d.className = 'log-entry';
    d.innerHTML = `<span class="log-time">[${t}]</span> ${msg}`;
    el.appendChild(d);
    if (el.children.length > 25) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
  }

  updateHUD() {
    const h = id => document.getElementById(id);
    const active = this.incidents.filter(i => i.status !== 'RESOLVED').length;
    if (h('hudCalls')) h('hudCalls').textContent = this.metrics.callsReceived;
    if (h('hudResponse')) h('hudResponse').textContent = this.metrics.callsReceived > 0 ? `${this.metrics.avgResponseTime.toFixed(1)} min` : '--';
    if (h('hudActive')) h('hudActive').textContent = active;
    if (h('hudSaved')) h('hudSaved').textContent = this.metrics.livesSaved;
  }

  updateInspectorHUD(a) {
    const h = id => document.getElementById(id);
    if (!a) return;
    if (h('inspectTitle')) h('inspectTitle').textContent = a.callSign || a.name || 'Agent';
    const spd = a.status === 'STANDBY' ? '0' : (a.speed * 20).toFixed(0);
    const loc = a.stationName ? ` · Station: ${a.stationName}` : '';
    if (h('inspectSub')) h('inspectSub').textContent = `Status: ${a.status} · Speed: ${spd} km/h${loc}`;
  }

  animate(ts) {
    const dt = Math.min(0.08, (ts - this.lastTime) / 1000);
    this.lastTime = ts;
    if (this.isRunning) this.update(dt);
    this.render();
    requestAnimationFrame(this.animate);
  }
}

window.CitySimulation = CitySimulation;
