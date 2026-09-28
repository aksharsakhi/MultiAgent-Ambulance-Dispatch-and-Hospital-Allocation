/**
 * AURA-EMS — Live Multi-Agent Simulation Cockpit Controller
 * Connects to Python Mesa Backend (/api/*) with Standalone Client-Side Fallback
 */

(function () {
  'use strict';

  // ── Configuration & State ────────────────────────────────
  let connectedToBackend = false;
  let isRunning = false;
  let simTimeSec = 0.0;
  let stepCount = 0;
  let runInterval = null;
  let playbackSpeed = 1.0;
  let currentScenario = 'baseline_normal';

  // City Grid Constants (6x6)
  const ROWS = 6;
  const COLS = 6;
  const SPACING = 2000.0;

  // Local Simulation Fallback State
  let localState = null;

  // DOM Elements
  const canvas = document.getElementById('cityCanvas');
  const ctx = canvas.getContext('2d');
  const backendPill = document.getElementById('backendStatusPill');
  const backendLabel = document.getElementById('backendStatusLabel');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const playIcon = document.getElementById('playIcon');
  const playText = document.getElementById('playText');
  const btnStep = document.getElementById('btnStep');
  const btnReset = document.getElementById('btnReset');
  const scenarioSelect = document.getElementById('scenarioSelect');
  const btnTriggerESI1 = document.getElementById('btnTriggerESI1');
  const btnTriggerMCI = document.getElementById('btnTriggerMCI');
  const fipaTerminal = document.getElementById('fipaTerminal');
  const btnClearLog = document.getElementById('btnClearLog');
  const fleetCardsContainer = document.getElementById('fleetCardsContainer');
  const hospitalCardsContainer = document.getElementById('hospitalCardsContainer');
  const incidentQueueList = document.getElementById('incidentQueueList');
  const badgeQueueCount = document.getElementById('badgeQueueCount');

  // KPI DOM
  const kpiAvgResp = document.getElementById('kpiAvgResp');
  const kpiESI1Resp = document.getElementById('kpiESI1Resp');
  const kpiRamping = document.getElementById('kpiRamping');
  const kpiGoldenHour = document.getElementById('kpiGoldenHour');
  const statActiveCalls = document.getElementById('statActiveCalls');
  const statFleetEnRoute = document.getElementById('statFleetEnRoute');
  const statSimTime = document.getElementById('statSimTime');

  // ── Initialization ───────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  function init() {
    setupCanvas();
    setupControls();
    setupThemeToggle();
    setupTabs();
    initLocalState();
    detectBackend();

    // Resize listener
    window.addEventListener('resize', () => {
      resizeCanvas();
      draw();
    });

    // Start initial render loop
    requestAnimationFrame(renderLoop);
  }

  // ══════════════════════════════════════════════════════════
  // BACKEND AUTO-DETECTION & REST API INTEGRATION
  // ══════════════════════════════════════════════════════════
  function detectBackend() {
    fetch('/api/status', { method: 'GET', cache: 'no-cache' })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Non-200 status');
      })
      .then(data => {
        connectedToBackend = true;
        backendLabel.textContent = `Python Mesa Core (Connected)`;
        backendPill.querySelector('.status-dot').className = 'status-dot online';
        logFipaMessage('INFORM', 'SYSTEM', 'DASHBOARD', `Connected to Python Mesa Backend (${data.framework}). Initialized.`);
        syncWithBackend();
      })
      .catch(() => {
        connectedToBackend = false;
        backendLabel.textContent = `In-Browser Engine (Client-Side)`;
        backendPill.querySelector('.status-dot').className = 'status-dot offline';
        logFipaMessage('INFORM', 'SYSTEM', 'DASHBOARD', `Running high-fidelity client-side simulation engine (GitHub Pages mode).`);
        draw();
      });
  }

  function syncWithBackend() {
    if (!connectedToBackend) return;
    fetch('/api/state')
      .then(res => res.json())
      .then(data => {
        updateFromBackendData(data);
      })
      .catch(err => {
        console.warn('Backend sync failed, falling back:', err);
      });
  }

  function updateFromBackendData(data) {
    stepCount = data.step;
    simTimeSec = data.sim_time_sec;
    isRunning = data.is_running;
    updatePlayPauseUI();

    // Map Backend State to View
    localState.ambulances = data.ambulances;
    localState.hospitals = data.hospitals;
    localState.incidents = data.incidents;

    // Messages
    if (data.messages && data.messages.length > 0) {
      renderBackendMessages(data.messages);
    }

    // Metrics
    if (data.metrics) {
      kpiAvgResp.textContent = `${data.metrics.avg_response_min} min`;
      kpiESI1Resp.textContent = `${data.metrics.esi1_response_min} min`;
      kpiRamping.textContent = `${data.metrics.ramping_delay_min.toFixed(2)} min`;
      kpiGoldenHour.textContent = `${data.metrics.golden_hour_rate}%`;
    }

    statSimTime.textContent = `${simTimeSec.toFixed(1)}s`;
    updateUILists();
    draw();
  }

  function renderBackendMessages(messages) {
    fipaTerminal.innerHTML = '';
    messages.forEach(msg => {
      const entry = document.createElement('div');
      entry.className = `term-entry ${msg.performative.toLowerCase()}`;
      entry.innerHTML = `
        <span class="time">[${msg.timestamp}s]</span>
        <span class="perf ${getPerfBadgeColor(msg.performative)}">${msg.performative}</span>
        <span class="detail">${msg.sender} ➔ ${msg.receiver}: ${msg.summary}</span>
      `;
      fipaTerminal.appendChild(entry);
    });
    fipaTerminal.scrollTop = fipaTerminal.scrollHeight;
  }

  // ══════════════════════════════════════════════════════════
  // CLIENT-SIDE LOCAL SIMULATION ENGINE (FALLBACK)
  // ══════════════════════════════════════════════════════════
  function initLocalState() {
    localState = {
      nodes: [],
      edges: [],
      ambulances: [
        { id: 'AMB-ALS-01', type: 'ALS', node: 0, x: 0, y: 0, state: 'IDLE', speed_kmh: 65, fuel_pct: 96, is_hems: false, active_incident: null, target_hospital: null },
        { id: 'AMB-ALS-02', type: 'ALS', node: 5, x: 5 * SPACING, y: 0, state: 'IDLE', speed_kmh: 65, fuel_pct: 100, is_hems: false, active_incident: null, target_hospital: null },
        { id: 'AMB-BLS-01', type: 'BLS', node: 30, x: 0, y: 5 * SPACING, state: 'IDLE', speed_kmh: 55, fuel_pct: 92, is_hems: false, active_incident: null, target_hospital: null },
        { id: 'AMB-BLS-02', type: 'BLS', node: 35, x: 5 * SPACING, y: 5 * SPACING, state: 'IDLE', speed_kmh: 55, fuel_pct: 100, is_hems: false, active_incident: null, target_hospital: null },
        { id: 'AMB-NICU-01', type: 'NICU', node: 17, x: 5 * SPACING, y: 2 * SPACING, state: 'IDLE', speed_kmh: 55, fuel_pct: 94, is_hems: false, active_incident: null, target_hospital: null },
        { id: 'AMB-HELI-01', type: 'HEMS', node: 14, x: 2 * SPACING, y: 2 * SPACING, state: 'IDLE', speed_kmh: 180, fuel_pct: 88, is_hems: true, active_incident: null, target_hospital: null }
      ],
      hospitals: [
        { id: 'HOSP-01', name: 'Apollo Metro Center', node: 14, x: 2 * SPACING, y: 2 * SPACING, trauma_level: 1, capacity: 18, occupied: 4, available: 14, occupancy_pct: 22.2, is_diverting: false },
        { id: 'HOSP-02', name: 'St. Jude General Hospital', node: 11, x: 5 * SPACING, y: 1 * SPACING, trauma_level: 2, capacity: 12, occupied: 3, available: 9, occupancy_pct: 25.0, is_diverting: false },
        { id: 'HOSP-03', name: 'Westside Community Hospital', node: 20, x: 2 * SPACING, y: 3 * SPACING, trauma_level: 3, capacity: 8, occupied: 2, available: 6, occupancy_pct: 25.0, is_diverting: false }
      ],
      incidents: []
    };

    // Generate Nodes
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const id = r * COLS + c;
        localState.nodes.push({ id, row: r, col: c, x: c * SPACING, y: r * SPACING });
      }
    }

    // Generate Edges
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const u = r * COLS + c;
        if (c + 1 < COLS) localState.edges.push({ u, v: r * COLS + (c + 1), congestion: 1.0 });
        if (r + 1 < ROWS) localState.edges.push({ u, v: (r + 1) * COLS + c, congestion: 1.0 });
      }
    }

    updateUILists();
  }

  function stepLocalSimulation() {
    stepCount++;
    simTimeSec += 5.0;
    statSimTime.textContent = `${simTimeSec.toFixed(1)}s`;

    // 1. Move Ambulances along target trajectories
    localState.ambulances.forEach(amb => {
      if (amb.state === 'EN_ROUTE_SCENE' && amb.targetNode !== undefined) {
        moveVehicleTowards(amb, amb.targetNode, 0.25, () => {
          amb.state = 'ON_SCENE';
          logFipaMessage('INFORM', amb.id, 'DISPATCHER', `On scene at Node ${amb.targetNode}. Patient triaged.`);
          setTimeout(() => {
            amb.state = 'EN_ROUTE_HOSPITAL';
            amb.targetHospital = 'HOSP-01';
            amb.targetNode = 14;
            logFipaMessage('INFORM', amb.id, 'HOSP-01', `Gale-Shapley match confirmed. Transporting to Apollo Metro.`);
          }, 1500);
        });
      } else if (amb.state === 'EN_ROUTE_HOSPITAL' && amb.targetNode !== undefined) {
        moveVehicleTowards(amb, amb.targetNode, 0.25, () => {
          amb.state = 'AT_HOSPITAL';
          logFipaMessage('INFORM', amb.id, 'HOSP-01', `Patient transferred into ER Resuscitation Bay. Zero ramping.`);
          // Remove incident
          localState.incidents = localState.incidents.filter(inc => inc.id !== amb.active_incident);
          setTimeout(() => {
            amb.state = 'IDLE';
            amb.active_incident = null;
            amb.targetNode = undefined;
          }, 2000);
        });
      }
    });

    // 2. Random Poisson Incidents in Baseline Flow
    if (Math.random() < 0.12 && localState.incidents.length < 5) {
      const randNode = Math.floor(Math.random() * 36);
      spawnIncidentLocal(randNode, Math.random() < 0.3 ? 1 : 2);
    }

    updateUILists();
    draw();
  }

  function moveVehicleTowards(amb, targetNodeId, speedFraction, onReach) {
    const targetNode = localState.nodes[targetNodeId];
    if (!targetNode) return;

    const dx = targetNode.x - amb.x;
    const dy = targetNode.y - amb.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 100) {
      amb.x = targetNode.x;
      amb.y = targetNode.y;
      amb.node = targetNodeId;
      if (onReach) onReach();
    } else {
      amb.x += (dx / dist) * 450 * speedFraction;
      amb.y += (dy / dist) * 450 * speedFraction;
    }
  }

  function spawnIncidentLocal(nodeId, esiLevel = 1, specialty = 'TRAUMA_SURGERY') {
    const node = localState.nodes[nodeId];
    if (!node) return;

    const incId = `INC-${String(localState.incidents.length + 1).padStart(2, '0')}`;
    const newInc = {
      id: incId,
      node: nodeId,
      x: node.x,
      y: node.y,
      esi: esiLevel,
      specialty: specialty,
      status: 'UNASSIGNED',
      assigned_amb: null
    };
    localState.incidents.push(newInc);

    logFipaMessage('CFP', 'DISPATCHER', 'ALL_AMBULANCES', `Call For Proposal: ${incId} at Node ${nodeId} (ESI-${esiLevel})`);

    // Find closest idle ambulance
    const idleAmbs = localState.ambulances.filter(a => a.state === 'IDLE');
    if (idleAmbs.length > 0) {
      const winner = idleAmbs.sort((a, b) => Math.hypot(a.x - node.x, a.y - node.y) - Math.hypot(b.x - node.x, b.y - node.y))[0];
      
      setTimeout(() => {
        logFipaMessage('PROPOSE', winner.id, 'DISPATCHER', `Bid: ETA ${((Math.hypot(winner.x - node.x, winner.y - node.y) / 1000) / 1.1).toFixed(1)}m`);
        setTimeout(() => {
          logFipaMessage('ACCEPT_PROPOSAL', 'DISPATCHER', winner.id, `Awarded ${incId}. Proceed via Time-Dependent A*.`);
          winner.state = 'EN_ROUTE_SCENE';
          winner.active_incident = incId;
          winner.targetNode = nodeId;
          newInc.status = 'DISPATCHED';
          newInc.assigned_amb = winner.id;
          updateUILists();
        }, 300);
      }, 300);
    }
    updateUILists();
  }

  // ══════════════════════════════════════════════════════════
  // USER CONTROLS & EVENT LISTENERS
  // ══════════════════════════════════════════════════════════
  function setupControls() {
    btnPlayPause.addEventListener('click', () => {
      if (connectedToBackend) {
        const endpoint = isRunning ? '/api/pause' : '/api/play';
        fetch(endpoint, { method: 'POST' }).then(() => {
          isRunning = !isRunning;
          updatePlayPauseUI();
        });
      } else {
        isRunning = !isRunning;
        updatePlayPauseUI();
        if (isRunning) {
          runInterval = setInterval(stepLocalSimulation, 400 / playbackSpeed);
        } else {
          clearInterval(runInterval);
        }
      }
    });

    btnStep.addEventListener('click', () => {
      if (connectedToBackend) {
        fetch('/api/step', { method: 'POST' })
          .then(res => res.json())
          .then(data => updateFromBackendData(data));
      } else {
        stepLocalSimulation();
      }
    });

    btnReset.addEventListener('click', () => {
      if (connectedToBackend) {
        fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario: currentScenario })
        })
          .then(res => res.json())
          .then(data => updateFromBackendData(data));
      } else {
        initLocalState();
        simTimeSec = 0.0;
        stepCount = 0;
        statSimTime.textContent = '0.0s';
        logFipaMessage('INFORM', 'SYSTEM', 'DASHBOARD', `Simulation reset to scenario: ${currentScenario}`);
        draw();
      }
    });

    scenarioSelect.addEventListener('change', (e) => {
      currentScenario = e.target.value;
      if (connectedToBackend) {
        fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario: currentScenario })
        })
          .then(res => res.json())
          .then(data => updateFromBackendData(data));
      } else {
        initLocalState();
        if (currentScenario === 'traffic_gridlock') {
          localState.edges.forEach(e => {
            if ((e.u === 14 && e.v === 15) || (e.u === 20 && e.v === 21)) e.congestion = 3.5;
          });
        } else if (currentScenario === 'hospital_surge') {
          localState.hospitals[0].occupied = 17;
          localState.hospitals[0].is_diverting = true;
        } else if (currentScenario === 'mass_casualty_incident') {
          for (let i = 0; i < 4; i++) spawnIncidentLocal(17, 1);
        }
        logFipaMessage('INFORM', 'SYSTEM', 'DASHBOARD', `Active Scenario switched: ${currentScenario}`);
        draw();
      }
    });

    btnTriggerESI1.addEventListener('click', () => {
      const randNode = Math.floor(Math.random() * 36);
      if (connectedToBackend) {
        fetch('/api/spawn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ node_id: randNode, esi: 1, specialty: 'TRAUMA_SURGERY' })
        }).then(() => syncWithBackend());
      } else {
        spawnIncidentLocal(randNode, 1, 'CARDIAC_CATH_LAB');
      }
    });

    btnTriggerMCI.addEventListener('click', () => {
      if (connectedToBackend) {
        fetch('/api/spawn_mci', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ node_id: 17, count: 6 })
        }).then(() => syncWithBackend());
      } else {
        for (let i = 0; i < 5; i++) spawnIncidentLocal(17, 1);
      }
    });

    // Speed Selector Buttons
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        playbackSpeed = parseFloat(btn.getAttribute('data-speed'));
        if (connectedToBackend) {
          fetch('/api/speed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speed: playbackSpeed })
          });
        } else if (isRunning) {
          clearInterval(runInterval);
          runInterval = setInterval(stepLocalSimulation, 400 / playbackSpeed);
        }
      });
    });

    btnClearLog.addEventListener('click', () => {
      fipaTerminal.innerHTML = '';
    });

    // Canvas Click Listener for Interactive Node Spawn
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const closestNode = findClosestNodeAtClick(clickX, clickY);
      if (closestNode !== null) {
        if (connectedToBackend) {
          fetch('/api/spawn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ node_id: closestNode, esi: 1, specialty: 'TRAUMA_SURGERY' })
          }).then(() => syncWithBackend());
        } else {
          spawnIncidentLocal(closestNode, 1);
        }
      }
    });
  }

  function updatePlayPauseUI() {
    if (isRunning) {
      btnPlayPause.classList.remove('primary');
      btnPlayPause.classList.add('danger');
      playIcon.textContent = '⏸';
      playText.textContent = 'Pause';
    } else {
      btnPlayPause.classList.remove('danger');
      btnPlayPause.classList.add('primary');
      playIcon.textContent = '▶';
      playText.textContent = 'Run Live';
    }
  }

  function getPerfBadgeColor(perf) {
    switch (perf) {
      case 'CFP': return 'blue';
      case 'PROPOSE': return 'green';
      case 'ACCEPT_PROPOSAL': return 'purple';
      case 'INFORM': return 'cyan';
      default: return 'red';
    }
  }

  function logFipaMessage(performative, sender, receiver, summary) {
    const entry = document.createElement('div');
    entry.className = `term-entry ${performative.toLowerCase()}`;
    entry.innerHTML = `
      <span class="time">[${simTimeSec.toFixed(1)}s]</span>
      <span class="perf ${getPerfBadgeColor(performative)}">${performative}</span>
      <span class="detail">${sender} ➔ ${receiver}: ${summary}</span>
    `;
    fipaTerminal.appendChild(entry);
    fipaTerminal.scrollTop = fipaTerminal.scrollHeight;
  }

  function setupTabs() {
    const tabs = document.querySelectorAll('.t-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const target = tab.getAttribute('data-tab');
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById(`tab-${target}`);
        if (pane) pane.classList.add('active');
      });
    });
  }

  function setupThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const saved = localStorage.getItem('aura-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);

    toggle.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      const next = cur === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('aura-theme', next);
      draw();
    });
  }

  // ══════════════════════════════════════════════════════════
  // UI LIST RENDERING (FLEET & HOSPITALS & QUEUE)
  // ══════════════════════════════════════════════════════════
  function updateUILists() {
    if (!localState) return;

    // 1. Fleet Cards
    fleetCardsContainer.innerHTML = '';
    localState.ambulances.forEach(amb => {
      const row = document.createElement('div');
      row.className = 'fleet-card-row';
      const isEnRoute = amb.state.includes('EN_ROUTE') || amb.state === 'ON_SCENE';
      row.innerHTML = `
        <div class="amb-id-wrap">
          <span class="amb-tag ${amb.type.toLowerCase()}">${amb.type}</span>
          <strong>${amb.id}</strong>
        </div>
        <span class="amb-state-badge ${isEnRoute ? 'active-mission' : ''}">${amb.state}</span>
        <span style="font-family: monospace; font-size: 0.72rem; color: var(--text-muted);">${amb.fuel_pct}% Fuel</span>
      `;
      fleetCardsContainer.appendChild(row);
    });

    // 2. Hospital Cards
    hospitalCardsContainer.innerHTML = '';
    localState.hospitals.forEach(hosp => {
      const row = document.createElement('div');
      row.className = 'hospital-card-row';
      const occPct = ((hosp.occupied / hosp.capacity) * 100).toFixed(0);
      row.innerHTML = `
        <div class="hosp-title-row">
          <span class="hosp-name">${hosp.name}</span>
          <span class="hosp-trauma">Level ${hosp.trauma_level} Trauma</span>
        </div>
        <div class="bed-bar-wrap">
          <div class="bed-bar-fill ${hosp.is_diverting ? 'diverting' : ''}" style="width: ${occPct}%;"></div>
        </div>
        <div class="hosp-metrics-sub">
          <span>${hosp.occupied} / ${hosp.capacity} Beds (${occPct}%)</span>
          <span style="color: ${hosp.is_diverting ? 'var(--red)' : 'var(--green)'}; font-weight: 700;">
            ${hosp.is_diverting ? 'DIVERTING' : 'OPEN BAYS'}
          </span>
        </div>
      `;
      hospitalCardsContainer.appendChild(row);
    });

    // 3. Incident Queue
    incidentQueueList.innerHTML = '';
    badgeQueueCount.textContent = `${localState.incidents.length} Active`;
    statActiveCalls.textContent = localState.incidents.length;
    statFleetEnRoute.textContent = localState.ambulances.filter(a => a.state.includes('EN_ROUTE')).length;

    if (localState.incidents.length === 0) {
      incidentQueueList.innerHTML = '<div class="empty-queue-msg">No active emergency calls pending dispatch. Nominal steady-state.</div>';
    } else {
      localState.incidents.forEach(inc => {
        const item = document.createElement('div');
        item.className = 'queue-entry';
        item.innerHTML = `
          <span class="inc-id">${inc.id}</span>
          <span>Node ${inc.node}</span>
          <span class="inc-esi esi${inc.esi}">ESI-${inc.esi}</span>
          <span style="font-size: 0.68rem; color: var(--text-dim);">${inc.status}</span>
        `;
        incidentQueueList.appendChild(item);
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 2D CANVAS DRAWING ENGINE (CITY GRAPH, AMBULANCES, INCIDENTS)
  // ══════════════════════════════════════════════════════════
  function setupCanvas() {
    resizeCanvas();
  }

  function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
  }

  function getCanvasCoords(worldX, worldY) {
    const padding = 50;
    const maxWorldX = (COLS - 1) * SPACING;
    const maxWorldY = (ROWS - 1) * SPACING;

    const scaleX = (canvas.width - padding * 2) / maxWorldX;
    const scaleY = (canvas.height - padding * 2) / maxWorldY;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (canvas.width - maxWorldX * scale) / 2;
    const offsetY = (canvas.height - maxWorldY * scale) / 2;

    return {
      x: offsetX + worldX * scale,
      y: offsetY + worldY * scale
    };
  }

  function findClosestNodeAtClick(clickX, clickY) {
    let closest = null;
    let minDist = 30; // 30px click radius

    localState.nodes.forEach(n => {
      const c = getCanvasCoords(n.x, n.y);
      const d = Math.hypot(clickX - c.x, clickY - c.y);
      if (d < minDist) {
        minDist = d;
        closest = n.id;
      }
    });
    return closest;
  }

  function draw() {
    if (!ctx || !localState) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // 1. Draw Streets / Edges
    localState.edges.forEach(e => {
      const uNode = localState.nodes[e.u];
      const vNode = localState.nodes[e.v];
      if (!uNode || !vNode) return;

      const p1 = getCanvasCoords(uNode.x, uNode.y);
      const p2 = getCanvasCoords(vNode.x, vNode.y);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);

      if (e.congestion > 2.0) {
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 4;
      } else if (e.congestion > 1.3) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
        ctx.lineWidth = 2;
      }
      ctx.stroke();
    });

    // 2. Draw Intersections / Nodes
    localState.nodes.forEach(n => {
      const c = getCanvasCoords(n.x, n.y);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#475569' : '#94a3b8';
      ctx.fill();

      // Node Label
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.fillText(`N${n.id}`, c.x + 6, c.y - 6);
    });

    // 3. Draw Hospitals
    localState.hospitals.forEach(hosp => {
      const c = getCanvasCoords(hosp.x, hosp.y);

      // Glowing Halo
      ctx.beginPath();
      ctx.arc(c.x, c.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = hosp.id === 'HOSP-01' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(59, 130, 246, 0.2)';
      ctx.fill();

      // Hospital Center
      ctx.beginPath();
      ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = hosp.id === 'HOSP-01' ? '#06b6d4' : '#2563eb';
      ctx.fill();

      // Red Cross Symbol
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(c.x - 2, c.y - 6, 4, 12);
      ctx.fillRect(c.x - 6, c.y - 2, 12, 4);

      // Hospital Name
      ctx.font = 'bold 10px "Outfit", sans-serif';
      ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
      ctx.fillText(hosp.name.split(' ')[0], c.x + 14, c.y + 4);
    });

    // 4. Draw Active Incidents
    localState.incidents.forEach(inc => {
      const c = getCanvasCoords(inc.x, inc.y);

      // Pulsing Ring
      const pulseRadius = 14 + Math.sin(Date.now() / 150) * 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = inc.esi === 1 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(245, 158, 11, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Incident Core
      ctx.beginPath();
      ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = inc.esi === 1 ? '#dc2626' : '#d97706';
      ctx.fill();

      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`!${inc.esi}`, c.x, c.y);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    });

    // 5. Draw Ambulances
    localState.ambulances.forEach(amb => {
      const c = getCanvasCoords(amb.x, amb.y);
      const isEnRoute = amb.state.includes('EN_ROUTE') || amb.state === 'ON_SCENE';

      if (isEnRoute) {
        // Flashing Siren Ring
        const sirenRadius = 12 + Math.cos(Date.now() / 120) * 3;
        ctx.beginPath();
        ctx.arc(c.x, c.y, sirenRadius, 0, Math.PI * 2);
        ctx.strokeStyle = Math.sin(Date.now() / 120) > 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Ambulance Icon Body
      ctx.beginPath();
      ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
      if (amb.type === 'ALS') ctx.fillStyle = '#ef4444';
      else if (amb.type === 'BLS') ctx.fillStyle = '#3b82f6';
      else if (amb.type === 'NICU') ctx.fillStyle = '#8b5cf6';
      else ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Ambulance Label
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
      ctx.fillText(amb.id.replace('AMB-', ''), c.x + 9, c.y + 3);
    });
  }

  function renderLoop() {
    draw();
    if (connectedToBackend && isRunning) {
      // Sync telemetry periodically when running
      if (stepCount % 4 === 0) syncWithBackend();
    }
    requestAnimationFrame(renderLoop);
  }

})();
