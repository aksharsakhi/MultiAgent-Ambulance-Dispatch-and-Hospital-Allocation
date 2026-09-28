/**
 * AURA-EMS — Clean Classic Keynote Presentation Controller
 * Page-Wise Navigation (6 Slides), Live MAS Simulation, & Interactive Defense
 */

(function () {
  'use strict';

  // ── Global References ────────────────────────────────────
  let sim = null;
  const totalSlides = 6;
  let currentSlide = 0;
  let allSlidesView = false;

  const slideTitles = [
    '01 / Title & Executive Overview',
    '02 / PEAS Formulation',
    '03 / Environment & Agent Analysis',
    '04 / Algorithmic Modeling & Search Strategy',
    '05 / Live MAS Simulation & System Validation',
    '06 / System Defense & Review 2 Roadmap'
  ];

  // ── DOM Initialization ───────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  function init() {
    setupDeckNavigation();
    setupThemeToggle();
    setupTimer();
    setupFullscreen();
    setupExportPDF();
    setupVivaAccordion();
    bootSim();
    setupSimControls();
    setupECG();
  }

  // ══════════════════════════════════════════════════════════
  // SIMULATION BOOTSTRAP
  // ══════════════════════════════════════════════════════════
  function bootSim() {
    try {
      const SimClass = window.CitySimulation || (typeof CitySimulation !== 'undefined' ? CitySimulation : null);
      if (SimClass) {
        sim = new SimClass('simCanvas');
        window.sim = sim;
      }
    } catch (e) {
      console.error('Simulation bootstrap failed:', e);
    }
  }

  // ══════════════════════════════════════════════════════════
  // PAGE-WISE DECK NAVIGATION
  // ══════════════════════════════════════════════════════════
  function setupDeckNavigation() {
    const slides = document.querySelectorAll('.slide-page');
    const pills = document.querySelectorAll('.nav-pill');
    const dots = document.querySelectorAll('.dot');
    const counter = document.getElementById('slideIndexCounter');
    const titleEl = document.getElementById('headerSlideTitle');
    const progressFill = document.getElementById('presProgressFill');

    const btnPrev = document.getElementById('btnPrevSlide');
    const btnNext = document.getElementById('btnNextSlide');
    const btnToggleAll = document.getElementById('btnToggleAllSlides');
    const viewModeText = document.getElementById('viewModeText');

    function goToSlide(idx) {
      currentSlide = Math.max(0, Math.min(totalSlides - 1, idx));

      // Update slide visibility
      slides.forEach((s, i) => s.classList.toggle('active', i === currentSlide));
      pills.forEach((p, i) => p.classList.toggle('active', i === currentSlide));
      dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));

      // Update Header & Footer
      if (counter) counter.textContent = `${currentSlide + 1} / ${totalSlides}`;
      if (titleEl) titleEl.textContent = slideTitles[currentSlide] || `Slide ${currentSlide + 1}`;
      if (progressFill) progressFill.style.width = `${((currentSlide + 1) / totalSlides) * 100}%`;

      // Trigger Simulation resize when entering slide 5 (index 4)
      if (currentSlide === 4 && sim) {
        setTimeout(() => {
          sim.handleResize();
          sim.updateHUD();
        }, 60);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Pill clicks
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        goToSlide(parseInt(pill.dataset.slide, 10));
      });
    });

    // Dot clicks
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        goToSlide(parseInt(dot.dataset.slide, 10));
      });
    });

    // Next / Prev button clicks
    if (btnPrev) btnPrev.addEventListener('click', () => goToSlide(currentSlide - 1));
    if (btnNext) btnNext.addEventListener('click', () => goToSlide(currentSlide + 1));

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        goToSlide(currentSlide + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToSlide(currentSlide - 1);
      }
    });

    // Toggle All-Slides scroll view vs Deck view
    if (btnToggleAll) {
      btnToggleAll.addEventListener('click', () => {
        allSlidesView = !allSlidesView;
        document.body.classList.toggle('all-slides-view', allSlidesView);
        if (viewModeText) viewModeText.textContent = allSlidesView ? 'Scroll View' : 'Slide View';
        if (!allSlidesView) goToSlide(currentSlide);
      });
    }

    // Initialize to Slide 0
    goToSlide(0);
  }

  // ══════════════════════════════════════════════════════════
  // THEME TOGGLE (Dark ↔ Light)
  // ══════════════════════════════════════════════════════════
  function setupThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    const saved = localStorage.getItem('aura-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);

    toggle.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('aura-theme', next);
      if (sim) sim.updateTheme();
    });
  }

  // ══════════════════════════════════════════════════════════
  // FULLSCREEN TOGGLE
  // ══════════════════════════════════════════════════════════
  function setupFullscreen() {
    const btn = document.getElementById('btnFullscreen');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // EXPORT TO PDF
  // ══════════════════════════════════════════════════════════
  function setupExportPDF() {
    const btn = document.getElementById('btnExportPDF');
    if (!btn) return;
    btn.addEventListener('click', () => {
      // Ensure simulation canvas is drawn before print
      if (sim) {
        try {
          sim.draw();
        } catch (e) {
          console.warn('Canvas render before print warning:', e);
        }
      }
      window.print();
    });
  }

  // ══════════════════════════════════════════════════════════
  // REHEARSAL TIMER
  // ══════════════════════════════════════════════════════════
  function setupTimer() {
    const chip = document.getElementById('rehearsalTimer');
    const text = document.getElementById('timerText');
    if (!chip || !text) return;

    let running = false, elapsed = 0, interval = null;

    function renderTime() {
      const m = Math.floor(elapsed / 60), s = elapsed % 60;
      text.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    chip.addEventListener('click', () => {
      if (running) {
        clearInterval(interval);
        running = false;
      } else {
        interval = setInterval(() => { elapsed++; renderTime(); }, 1000);
        running = true;
      }
    });

    chip.addEventListener('dblclick', () => {
      clearInterval(interval);
      running = false;
      elapsed = 0;
      renderTime();
    });
  }

  // ══════════════════════════════════════════════════════════
  // VIVA DEFENSE ACCORDION
  // ══════════════════════════════════════════════════════════
  function setupVivaAccordion() {
    document.querySelectorAll('.viva-card').forEach(card => {
      const q = card.querySelector('.viva-q');
      if (!q) return;
      q.addEventListener('click', () => {
        const wasActive = card.classList.contains('active');
        document.querySelectorAll('.viva-card').forEach(c => c.classList.remove('active'));
        if (!wasActive) card.classList.add('active');
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // SIMULATION CONTROLS
  // ══════════════════════════════════════════════════════════
  function setupSimControls() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    on('btnEmergency', () => {
      if (!sim) return;
      const available = sim.nodes.filter(n => !sim.ambulances.some(a => a.baseNodeId === n.id) && !sim.hospitals.some(h => h.nodeId === n.id));
      const n = available[Math.floor(Math.random() * available.length)] || sim.nodes[17];
      sim.spawnIncident(n.id, 1);
    });

    on('btnMCI', () => {
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

    on('btnClearInc', () => {
      if (!sim) return;
      sim.incidents = sim.incidents.filter(i => i.status !== 'RESOLVED');
      sim.updateHUD();
    });

    // Speed Multipliers
    const speedBtns = [
      { id: 'btnSlow', spd: 0.5 },
      { id: 'btnNormal', spd: 1.0 },
      { id: 'btnFast', spd: 2.0 },
    ];
    speedBtns.forEach(({ id, spd }) => {
      on(id, () => {
        if (!sim) return;
        sim.simSpeed = spd;
        speedBtns.forEach(b => document.getElementById(b.id)?.classList.toggle('active', b.id === id));
      });
    });

    on('btnPause', () => {
      if (!sim) return;
      sim.isRunning = !sim.isRunning;
      const el = document.getElementById('btnPause');
      if (el) el.textContent = sim.isRunning ? '⏸ Pause' : '▶ Play';
    });
  }

  // ══════════════════════════════════════════════════════════
  // TELEMETRY ECG MONITOR (Canvas Animation)
  // ══════════════════════════════════════════════════════════
  function setupECG() {
    const canvas = document.getElementById('ecgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const updateSize = () => {
      const parentW = canvas.parentElement ? canvas.parentElement.getBoundingClientRect().width : 280;
      canvas.width = Math.floor(parentW) || 280;
      canvas.height = 28;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    let offset = 0;
    function drawECG() {
      const w = canvas.width, h = canvas.height;
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      ctx.clearRect(0, 0, w, h);

      // Waveform
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < w; x++) {
        const t = (x + offset) * 0.06;
        const beat = Math.exp(-Math.pow((t % 6) - 2, 2) * 8) * 11;
        const y = h / 2 - beat + Math.sin(t * 0.5) * 1.2;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Baseline
      ctx.beginPath();
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 0.5;
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      offset += 1.2;
      requestAnimationFrame(drawECG);
    }
    drawECG();
  }

})();
