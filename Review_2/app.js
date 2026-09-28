/**
 * AURA-EMS — Review 2 Keynote Presentation Controller
 * Multi-Agent Engine, Stress Scenarios, Benchmarks & Oral Defense
 */

(function () {
  'use strict';

  // ── Global State ──────────────────────────────────────────
  const totalSlides = 6;
  let currentSlide = 0;

  const scenariosData = [
    {
      title: 'Baseline Urban Operations',
      subtitle: 'Steady-State Metropolitan Dispatch & Queue Equilibrium',
      badge: 'green',
      badgeText: 'Scenario 1: Baseline Flow',
      params: [
        '<strong>Arrival Process:</strong> Poisson distribution with rate λ = 0.4 calls/min.',
        '<strong>Triage Acuity:</strong> ESI-1: 10%, ESI-2: 25%, ESI-3: 40%, ESI-4: 25%.',
        '<strong>Traffic Conditions:</strong> Nominal speed (45 km/h), stochastic intersection delays.',
        '<strong>Active Fleet:</strong> 4 Ambulances (1 ALS, 2 BLS, 1 Moto), 3 Regional Hospitals.'
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

  const plotCaptions = {
    'benchmarks/plots/response_time_comparison.png': 'Figure 1: Mean response time comparison across triage acuity classes ESI 1 to 5 showing 78% speedup in critical cases.',
    'benchmarks/plots/offload_delay_reduction.png': 'Figure 2: Complete eradication of Emergency Department ambulance ramping delays via Gale-Shapley bed allocation.',
    'benchmarks/plots/specialty_matching_rate.png': 'Figure 3: Clinical specialty matching accuracy (Cath Lab, Trauma, Neuro) reaching 100% with multi-agent coordination.',
    'benchmarks/plots/mci_disaster_clearance.png': 'Figure 4: Mass Casualty Incident clearance timeline demonstrating 54% faster disaster evacuation under AURA-EMS.'
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
        pill.classList.toggle('active', idx === currentSlide);
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
      } else if (e.key >= '1' && e.key <= '6') {
        goToSlide(parseInt(e.key, 10) - 1);
      } else if (e.key === 'Home') {
        goToSlide(0);
      } else if (e.key === 'End') {
        goToSlide(totalSlides - 1);
      }
    });

    goToSlide(0);
  }

  // ══════════════════════════════════════════════════════════
  // THEME TOGGLE (Default: Light Mode)
  // ══════════════════════════════════════════════════════════
  function setupThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    // Strict default to light mode as requested
    const saved = localStorage.getItem('aura-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);

    toggle.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      const next = cur === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('aura-theme', next);
      updateThemeIcon(next);
    });

    function updateThemeIcon(t) {
      const icon = toggle.querySelector('.theme-icon');
      if (icon) icon.textContent = t === 'light' ? '🌙' : '☀️';
    }
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
      running = !running;
      chip.style.borderColor = running ? 'var(--blue)' : 'var(--border)';
      if (running) {
        interval = setInterval(() => { elapsed++; renderTime(); }, 1000);
      } else {
        clearInterval(interval);
      }
    });

    chip.addEventListener('dblclick', () => {
      clearInterval(interval);
      running = false;
      elapsed = 0;
      renderTime();
      chip.style.borderColor = 'var(--border)';
    });
  }

  // ══════════════════════════════════════════════════════════
  // FULLSCREEN & EXPORT PDF
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

  function setupExportPDF() {
    const btn = document.getElementById('btnExportPDF');
    if (!btn) return;
    btn.addEventListener('click', () => {
      window.print();
    });
  }

  // ══════════════════════════════════════════════════════════
  // SCENARIO SWITCHER (Slide 4)
  // ══════════════════════════════════════════════════════════
  function setupScenarioSwitcher() {
    const tabBtns = document.querySelectorAll('.scen-tab-btn');
    const display = document.getElementById('scenarioDisplay');
    if (!tabBtns.length || !display) return;

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const idx = parseInt(btn.getAttribute('data-scen'), 10);
        renderScenario(idx);
      });
    });

    function renderScenario(idx) {
      const s = scenariosData[idx];
      if (!s) return;

      const paramsHtml = s.params.map(p => `<li>${p}</li>`).join('');

      display.innerHTML = `
        <div class="scen-content active">
          <div class="scen-header">
            <div class="scen-badge ${s.badge}">${s.badgeText}</div>
            <h3>${s.title} — ${s.subtitle}</h3>
          </div>
          <div class="scen-grid">
            <div class="scen-params">
              <h4>Simulation Hyperparameters</h4>
              <ul>${paramsHtml}</ul>
            </div>
            <div class="scen-outcome">
              <h4>Empirical Multi-Agent Outcome</h4>
              <div class="metric-row">
                <div class="metric-box">
                  <span class="val ${s.badge === 'red' ? 'blue' : 'green'}">${s.avgResp}</span>
                  <span class="lbl">Avg Response Time</span>
                </div>
                <div class="metric-box">
                  <span class="val blue">${s.ramping}</span>
                  <span class="lbl">Ramping Delay</span>
                </div>
                <div class="metric-box">
                  <span class="val purple">${s.matchRate}</span>
                  <span class="lbl">Clinical Match</span>
                </div>
              </div>
              <p class="scen-verdict">${s.verdict}</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  // ══════════════════════════════════════════════════════════
  // PLOT GALLERY VIEWER (Slide 5)
  // ══════════════════════════════════════════════════════════
  function setupPlotGallery() {
    const plotBtns = document.querySelectorAll('.plot-btn');
    const activeImg = document.getElementById('activePlotImg');
    const caption = document.getElementById('plotCaption');
    if (!plotBtns.length || !activeImg) return;

    plotBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        plotBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const imgPath = btn.getAttribute('data-img');
        if (imgPath) {
          activeImg.src = imgPath;
          if (caption && plotCaptions[imgPath]) {
            caption.textContent = plotCaptions[imgPath];
          }
        }
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // VIVA ACCORDION (Slide 6)
  // ══════════════════════════════════════════════════════════
  function setupVivaAccordion() {
    const items = document.querySelectorAll('.viva-item');
    items.forEach((item) => {
      const q = item.querySelector('.viva-q');
      if (!q) return;
      q.addEventListener('click', () => {
        const wasActive = item.classList.contains('active');
        items.forEach(it => it.classList.remove('active'));
        if (!wasActive) item.classList.add('active');
      });
    });
  }

})();
