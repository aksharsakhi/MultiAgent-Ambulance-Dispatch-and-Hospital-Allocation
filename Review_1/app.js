/**
 * AURA-EMS — Application Controller
 * Premium interactions, theme toggle, deck navigation
 */

(function () {
  'use strict';

  // ── Simulation Bootstrap ─────────────────────────────────
  let sim;
  function bootSim() {
    try {
      const SimClass = window.CitySimulation || (typeof CitySimulation !== 'undefined' ? CitySimulation : null);
      if (SimClass) {
        sim = new SimClass('simCanvas');
        window.sim = sim;
      } else {
        console.warn('CitySimulation class not defined yet.');
      }
    } catch (e) {
      console.error('Sim initialization failed:', e);
    }
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  function init() {
    bootSim();
    setupThemeToggle();
    setupDeck();
    setupTimer();
    setupSimControls();
    setupPeasTabs();
    setupVivaAccordion();
    setupSliders();
    setupGaleShapley();
    setupECG();
  }

  // ══════════════════════════════════════════════════════════
  // THEME TOGGLE (Dark ↔ Light)
  // ══════════════════════════════════════════════════════════
  function setupThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    // Read saved preference
    const saved = localStorage.getItem('aura-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);

    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('aura-theme', next);

      // Notify simulation to update palette
      if (sim) sim.updateTheme();
    });
  }

  // ══════════════════════════════════════════════════════════
  // DECK NAVIGATION (Stage tabs + arrows)
  // ══════════════════════════════════════════════════════════
  let currentStage = 0;
  const totalStages = 5;
  let deckMode = true;

  function setupDeck() {
    const tabs = document.querySelectorAll('.stage-tab');
    const cards = document.querySelectorAll('.stage-card');
    const counter = document.getElementById('stageCounter');
    const prevBtn = document.getElementById('btnPrev');
    const nextBtn = document.getElementById('btnNext');
    const deckBtn = document.getElementById('btnDeckMode');
    const deckText = document.getElementById('deckModeText');

    function goToStage(idx) {
      currentStage = Math.max(0, Math.min(totalStages - 1, idx));
      tabs.forEach((t, i) => t.classList.toggle('active', i === currentStage));
      if (deckMode) {
        cards.forEach((c, i) => c.classList.toggle('active', i === currentStage));
      }
      if (counter) counter.textContent = `${currentStage + 1} / ${totalStages}`;
      if (currentStage === 0 && sim) {
        setTimeout(() => sim.handleResize(), 60);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        goToStage(parseInt(tab.dataset.stage));
      });
    });

    if (prevBtn) prevBtn.addEventListener('click', () => goToStage(currentStage - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goToStage(currentStage + 1));

    if (deckBtn) {
      deckBtn.addEventListener('click', () => {
        deckMode = !deckMode;
        document.body.classList.toggle('full-view', !deckMode);
        if (deckText) deckText.textContent = deckMode ? 'Deck' : 'Full';
        if (deckMode) goToStage(currentStage);
        else document.querySelectorAll('.stage-card').forEach(c => c.classList.add('active'));
      });
    }

    // Keyboard nav
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goToStage(currentStage + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goToStage(currentStage - 1); }
    });
  }

  // ══════════════════════════════════════════════════════════
  // TIMER
  // ══════════════════════════════════════════════════════════
  function setupTimer() {
    const chip = document.getElementById('rehearsalTimer');
    const text = document.getElementById('timerText');
    if (!chip || !text) return;

    let running = false, elapsed = 0, interval;
    function updateDisplay() { const m = Math.floor(elapsed / 60), s = elapsed % 60; text.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }

    chip.addEventListener('click', () => {
      if (running) { clearInterval(interval); running = false; }
      else { interval = setInterval(() => { elapsed++; updateDisplay(); }, 1000); running = true; }
    });

    chip.addEventListener('dblclick', () => {
      clearInterval(interval); running = false; elapsed = 0; updateDisplay();
    });
  }

  // ══════════════════════════════════════════════════════════
  // SIMULATION CONTROLS
  // ══════════════════════════════════════════════════════════
  function setupSimControls() {
    const btn = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

    btn('btnEmergency', () => {
      if (sim) {
        const available = sim.nodes.filter(n => !sim.ambulances.some(a => a.baseNodeId === n.id) && !sim.hospitals.some(h => h.nodeId === n.id));
        const n = available[Math.floor(Math.random() * available.length)] || sim.nodes[17];
        sim.spawnIncident(n.id, 1);
      }
    });
    btn('btnMCI', () => {
      if (!sim) return;
      const targets = [17, 18, 24];
      targets.forEach((nodeId, i) => {
        setTimeout(() => {
          sim.spawnIncident(nodeId, 1, `MCI Blast Casualty #${i + 1}`);
        }, i * 450);
      });
      if (sim.helicopter) {
        sim.dispatchHeli(17);
      }
    });
    btn('btnClearInc', () => {
      if (sim) {
        sim.incidents = sim.incidents.filter(i => i.status !== 'RESOLVED');
        sim.updateHUD();
      }
    });
    btn('btnSlow', () => { if (sim) sim.simSpeed = 0.5; });
    btn('btnNormal', () => { if (sim) sim.simSpeed = 1.0; });
    btn('btnFast', () => { if (sim) sim.simSpeed = 2.0; });
    btn('btnPause', () => {
      if (!sim) return;
      sim.isRunning = !sim.isRunning;
      const el = document.getElementById('btnPause');
      if (el) el.textContent = sim.isRunning ? '⏸ Pause' : '▶ Play';
    });
  }

  // ══════════════════════════════════════════════════════════
  // PEAS TABS
  // ══════════════════════════════════════════════════════════
  function setupPeasTabs() {
    const tabs = document.querySelectorAll('.peas-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.peas-view').forEach(v => v.classList.remove('active'));
        tab.classList.add('active');
        const view = document.getElementById(`peas-${tab.dataset.peas}`);
        if (view) view.classList.add('active');
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // VIVA ACCORDION
  // ══════════════════════════════════════════════════════════
  function setupVivaAccordion() {
    document.querySelectorAll('.viva-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.viva-item');
        const wasActive = item.classList.contains('active');
        // Close all
        document.querySelectorAll('.viva-item').forEach(i => i.classList.remove('active'));
        // Toggle clicked
        if (!wasActive) item.classList.add('active');
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // UTILITY SLIDERS
  // ══════════════════════════════════════════════════════════
  function setupSliders() {
    const ids = [['sGamma', 'vGamma'], ['sDelta', 'vDelta'], ['sPsi', 'vPsi']];
    const result = document.getElementById('utilResult');
    const winner = document.getElementById('utilWinner');

    function compute() {
      const g = parseFloat(document.getElementById('sGamma')?.value || 3);
      const d = parseFloat(document.getElementById('sDelta')?.value || 1);
      const p = parseFloat(document.getElementById('sPsi')?.value || 0.5);
      const eta = 5.4, dist = 3.2, load = 0.6, fuel = 1.2;
      const u = -(g * eta + d * dist + p * load + 0.3 * fuel);
      if (result) result.textContent = `U = ${u.toFixed(1)}`;
      if (winner) winner.textContent = u > -20 ? '🏆 Rescue Alpha wins bid' : '🏆 Medic Bravo wins bid';
    }

    ids.forEach(([sId, vId]) => {
      const slider = document.getElementById(sId);
      const val = document.getElementById(vId);
      if (slider && val) {
        slider.addEventListener('input', () => { val.textContent = slider.value; compute(); });
      }
    });
    compute();
  }

  // ══════════════════════════════════════════════════════════
  // GALE-SHAPLEY DEMO
  // ══════════════════════════════════════════════════════════
  function setupGaleShapley() {
    const btn = document.getElementById('btnRunGS');
    const log = document.getElementById('gsLog');
    const status = document.getElementById('gsStable');
    if (!btn || !log) return;

    let round = 0;
    const ambs = ['Rescue Alpha', 'Medic Bravo', 'Rapid Charlie', 'Delta LifeLine'];
    const hosps = ['Metro Trauma', 'Apex Cardiac', 'St. Jude ER', 'Valley Care'];
    const steps = [
      { msg: 'Round 1: Rescue Alpha proposes to Metro Trauma → ACCEPTED (tentative).', stable: false },
      { msg: 'Round 1: Medic Bravo proposes to Apex Cardiac → ACCEPTED (tentative).', stable: false },
      { msg: 'Round 2: Rapid Charlie proposes to Metro Trauma → REJECTED (Rescue Alpha preferred). Proposes to St. Jude ER → ACCEPTED.', stable: false },
      { msg: 'Round 2: Delta LifeLine proposes to Valley Care → ACCEPTED.', stable: false },
      { msg: '✅ All ambulances matched. No blocking pairs exist. Matching is STABLE.', stable: true },
    ];

    btn.addEventListener('click', () => {
      if (round >= steps.length) { round = 0; log.innerHTML = ''; }
      const step = steps[round];
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.innerHTML = `<span class="log-time">[R${Math.ceil((round + 1) / 2)}]</span> ${step.msg}`;
      log.appendChild(entry); log.scrollTop = log.scrollHeight;
      if (status) status.textContent = step.stable ? '✅ Stable Matching Found' : `⏳ Round ${Math.ceil((round + 1) / 2)} in progress...`;
      if (status) status.className = step.stable ? 'text-green' : 'text-amber';
      round++;
    });
  }

  // ══════════════════════════════════════════════════════════
  // ECG MONITOR (Animated sine-like vitals)
  // ══════════════════════════════════════════════════════════
  function setupECG() {
    const canvas = document.getElementById('ecgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const updateSize = () => {
      const parentW = canvas.parentElement ? canvas.parentElement.getBoundingClientRect().width : 280;
      canvas.width = Math.floor(parentW) || 280;
      canvas.height = 32;
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    let offset = 0;

    function drawECG() {
      const w = canvas.width, h = canvas.height;
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5;
      for (let x = 0; x < w; x++) {
        const t = (x + offset) * 0.06;
        const beat = Math.exp(-Math.pow((t % 6) - 2, 2) * 8) * 12;
        const y = h / 2 - beat + Math.sin(t * 0.5) * 1.5;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Baseline
      ctx.beginPath(); ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 0.5; ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

      offset += 1.2;
      requestAnimationFrame(drawECG);
    }
    drawECG();
  }

})();
