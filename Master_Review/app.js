/**
 * AURA-EMS — Master Review Presentation Controller
 * Combined Defense: Review 1 (Theory & Formalisms) + Review 2 (Implementation & Benchmarks)
 * 10-Slide Unified Master Keynote Deck (20 Marks Total)
 */

(function () {
  'use strict';

  // ── Global State ──────────────────────────────────────────
  const totalSlides = 10;
  let currentSlide = 0;

  // ── Scenario Data for Slide 7 ─────────────────────────────
  const scenariosData = [
    {
      title: 'Baseline Urban Operations',
      subtitle: 'Steady-State Metropolitan Dispatch & Queue Equilibrium',
      badge: 'green',
      badgeText: 'Scenario 1: Baseline Flow',
      params: [
        '<strong>Arrival Process:</strong> Poisson distribution with rate λ = 0.4 calls/min across 36 intersections.',
        '<strong>Triage Acuity:</strong> ESI-1: 10%, ESI-2: 25%, ESI-3: 40%, ESI-4: 25%.',
        '<strong>Traffic Conditions:</strong> Nominal speed (45 km/h), stochastic intersection delays.',
        '<strong>Active Fleet:</strong> 6 Ambulances (2 ALS, 3 BLS, 1 Moto), 3 Regional Hospitals.'
      ],
      avgResp: '4.82 min',
      ramping: '0.00 min',
      matchRate: '100%',
      verdict: 'Contract Net Protocol achieves optimal Nash equilibrium with 0 idle resource starvation and perfect fleet rotation.'
    },
    {
      title: 'Multi-Vehicle Highway Collision (MCI)',
      subtitle: 'Mass Casualty Surge with High-Acuity Priority Inundation',
      badge: 'red',
      badgeText: 'Scenario 2: Mass Casualty (MCI)',
      params: [
        '<strong>Incident Profile:</strong> 6 simultaneous critical patients (4 ESI-1, 2 ESI-2) on Highway Node N10.',
        '<strong>Triage Protocol:</strong> Automatic batching & rapid motorcycle stabilization dispatch.',
        '<strong>Fleet Mobilization:</strong> 100% fleet recall + mutual aid coordination.',
        '<strong>Target Benchmark:</strong> Evacuation clearance within golden window (< 15 min).'
      ],
      avgResp: '3.12 min',
      ramping: '0.00 min',
      matchRate: '100%',
      verdict: 'Multi-agent wave dispatch evacuated all 6 victims in 11.4 min vs 24.8 min under serial CAD dispatch (54% clearance speedup).'
    },
    {
      title: 'Hospital Bed Crisis & ER Diversion',
      subtitle: 'Catastrophic ED Saturation Avoidance via Dynamic Gale-Shapley Matching',
      badge: 'purple',
      badgeText: 'Scenario 3: ED Bed Saturation',
      params: [
        '<strong>Central Hospital (H1):</strong> 95% bed capacity saturated (19/20 beds occupied).',
        '<strong>Trigger Threshold:</strong> Proactive diversion signal sent at 85% occupancy.',
        '<strong>Secondary Facilities:</strong> St. Jude (H2: 45% full), City General (H3: 60% full).',
        '<strong>Matching Metric:</strong> Two-sided stable Gale-Shapley optimization.'
      ],
      avgResp: '5.20 min',
      ramping: '0.00 min',
      matchRate: '100%',
      verdict: 'Completely eliminated ambulance offload ramping (saving 22 min per crew) by dynamically rerouting to St. Jude without central human intervention.'
    },
    {
      title: 'Severe Weather Grid Storm',
      subtitle: 'Catastrophic Road Failures with Dynamic A* / D* Lite Rerouting',
      badge: 'amber',
      badgeText: 'Scenario 4: Severe Grid Storm',
      params: [
        '<strong>Environmental Shock:</strong> 50% link throughput reduction + 3 arterial road closures.',
        '<strong>Replanning Engine:</strong> Dynamic D* Lite continuous edge weight cost updates.',
        '<strong>Congestion Multiplier:</strong> Peak congestion factor c(e, t) = 3.5x nominal delay.',
        '<strong>Fleet Routing:</strong> Decentralized real-time alternate path synthesis.'
      ],
      avgResp: '6.45 min',
      ramping: '0.00 min',
      matchRate: '98.5%',
      verdict: 'D* Lite replanned around blocked bridges in 1.4 milliseconds, averting gridlock delays that stalled legacy CAD ambulances by 28+ minutes.'
    }
  ];

  // ── Publication Plot Captions for Slide 8 ──────────────────
  const plotCaptions = {
    '../Review_2/benchmarks/plots/response_time_comparison.png': 'Figure 1: Mean response time comparison across triage acuity classes ESI 1 to 5 showing 78% speedup in critical cases.',
    '../Review_2/benchmarks/plots/offload_delay_reduction.png': 'Figure 2: Complete eradication of Emergency Department ambulance ramping delays via Gale-Shapley bed allocation.',
    '../Review_2/benchmarks/plots/specialty_matching_rate.png': 'Figure 3: Clinical specialty matching accuracy (Cath Lab, Trauma, Neuro) reaching 100% with multi-agent coordination.',
    '../Review_2/benchmarks/plots/mci_disaster_clearance.png': 'Figure 4: Mass Casualty Incident clearance timeline demonstrating 54% faster disaster evacuation under AURA-EMS.'
  };

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
    setupScenarioSwitcher();
    setupPlotGallery();
    setupVivaAccordion();
  }

  // ══════════════════════════════════════════════════════════
  // PAGE-WISE DECK NAVIGATION
  // ══════════════════════════════════════════════════════════
  function setupDeckNavigation() {
    const pages = document.querySelectorAll('.slide-page');
    const pills = document.querySelectorAll('.pill-btn');
    const btnPrev = document.getElementById('btnPrevSlide');
    const btnNext = document.getElementById('btnNextSlide');
    const indicator = document.getElementById('slideIndicator');
    const progress = document.getElementById('progressBarFill');

    function goToSlide(index) {
      if (index < 0 || index >= totalSlides) return;
      currentSlide = index;

      pages.forEach((p, idx) => {
        if (idx === currentSlide) {
          p.classList.add('active');
          p.scrollTop = 0;
        } else {
          p.classList.remove('active');
        }
      });

      pills.forEach((pill, idx) => {
        const isActive = (idx === currentSlide);
        pill.classList.toggle('active', isActive);
        if (isActive) {
          pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      });

      if (indicator) indicator.textContent = `Slide ${currentSlide + 1} of ${totalSlides}`;
      if (progress) progress.style.width = `${((currentSlide + 1) / totalSlides) * 100}%`;

      if (btnPrev) btnPrev.disabled = (currentSlide === 0);
      if (btnNext) btnNext.disabled = (currentSlide === totalSlides - 1);
    }

    if (btnPrev) btnPrev.addEventListener('click', () => goToSlide(currentSlide - 1));
    if (btnNext) btnNext.addEventListener('click', () => goToSlide(currentSlide + 1));

    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const target = parseInt(pill.getAttribute('data-slide'), 10);
        if (!isNaN(target)) goToSlide(target);
      });
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goToSlide(currentSlide + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToSlide(currentSlide - 1);
      } else if (e.key >= '1' && e.key <= '9') {
        goToSlide(parseInt(e.key, 10) - 1);
      } else if (e.key === '0') {
        goToSlide(9); // Slide 10
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    });

    // Initialize first slide
    goToSlide(0);
  }

  // ══════════════════════════════════════════════════════════
  // THEME TOGGLE (Default: Light Mode)
  // ══════════════════════════════════════════════════════════
  function setupThemeToggle() {
    const toggleBtn = document.getElementById('themeToggleBtn');
    const themeIcon = document.getElementById('themeIcon');
    const themeLabel = document.getElementById('themeLabel');

    const savedTheme = localStorage.getItem('aura-theme') || 'light';
    applyTheme(savedTheme);

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'light' ? 'dark' : 'light';
        applyTheme(next);
      });
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('aura-theme', theme);
      if (themeIcon) themeIcon.textContent = theme === 'light' ? '☀️' : '🌙';
      if (themeLabel) themeLabel.textContent = theme === 'light' ? 'Light' : 'Dark';
    }
  }

  // ══════════════════════════════════════════════════════════
  // SPEECH / VIVA TIMER
  // ══════════════════════════════════════════════════════════
  function setupTimer() {
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBtn = document.getElementById('btnToggleTimer');
    let seconds = 0;
    let timerId = null;

    function formatTime(s) {
      const mins = Math.floor(s / 60).toString().padStart(2, '0');
      const secs = (s % 60).toString().padStart(2, '0');
      return `${mins}:${secs}`;
    }

    if (timerBtn) {
      timerBtn.addEventListener('click', () => {
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
          timerBtn.textContent = '▶ Resume';
        } else {
          timerId = setInterval(() => {
            seconds++;
            if (timerDisplay) timerDisplay.textContent = formatTime(seconds);
          }, 1000);
          timerBtn.textContent = '⏸ Pause';
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // FULLSCREEN MODE
  // ══════════════════════════════════════════════════════════
  function setupFullscreen() {
    const btn = document.getElementById('btnFullscreen');
    if (btn) btn.addEventListener('click', toggleFullscreen);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }

  // ══════════════════════════════════════════════════════════
  // PDF EXPORT
  // ══════════════════════════════════════════════════════════
  function setupExportPDF() {
    const btn = document.getElementById('btnExportPDF');
    if (btn) {
      btn.addEventListener('click', () => {
        window.print();
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 7: SCENARIO SWITCHER
  // ══════════════════════════════════════════════════════════
  function setupScenarioSwitcher() {
    const btns = document.querySelectorAll('.scenario-tab-btn');
    const titleEl = document.getElementById('scenarioTitle');
    const subtitleEl = document.getElementById('scenarioSubtitle');
    const badgeEl = document.getElementById('scenarioBadge');
    const paramsEl = document.getElementById('scenarioParams');
    const respEl = document.getElementById('scenarioAvgResp');
    const rampEl = document.getElementById('scenarioRamping');
    const matchEl = document.getElementById('scenarioMatchRate');
    const verdictEl = document.getElementById('scenarioVerdict');

    btns.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const data = scenariosData[idx];
        if (!data) return;

        if (titleEl) titleEl.textContent = data.title;
        if (subtitleEl) subtitleEl.textContent = data.subtitle;
        if (badgeEl) {
          badgeEl.className = `badge badge-${data.badge}`;
          badgeEl.textContent = data.badgeText;
        }
        if (paramsEl) {
          paramsEl.innerHTML = data.params.map(p => `<li>${p}</li>`).join('');
        }
        if (respEl) respEl.textContent = data.avgResp;
        if (rampEl) rampEl.textContent = data.ramping;
        if (matchEl) matchEl.textContent = data.matchRate;
        if (verdictEl) verdictEl.textContent = data.verdict;
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 8: PUBLICATION PLOT GALLERY
  // ══════════════════════════════════════════════════════════
  function setupPlotGallery() {
    const plotBtns = document.querySelectorAll('.plot-tab-btn');
    const plotImg = document.getElementById('activePlotImg');
    const plotCaption = document.getElementById('plotCaption');

    plotBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        plotBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const src = btn.getAttribute('data-plot');
        if (plotImg && src) {
          plotImg.src = src;
          plotImg.alt = btn.textContent;
          if (plotCaption) {
            plotCaption.textContent = plotCaptions[src] || btn.textContent;
          }
        }
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 10: VIVA ACCORDION
  // ══════════════════════════════════════════════════════════
  function setupVivaAccordion() {
    const items = document.querySelectorAll('.viva-item');
    items.forEach((item) => {
      const header = item.querySelector('.viva-header');
      if (header) {
        header.addEventListener('click', () => {
          const isOpen = item.classList.contains('open');
          // Close others
          items.forEach(i => i.classList.remove('open'));
          if (!isOpen) item.classList.add('open');
        });
      }
    });
  }

})();
