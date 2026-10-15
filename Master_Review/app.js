/**
 * AURA-EMS — Master Defense Presentation Controller
 * Unified Case Study Defense (20 Marks Total)
 * 14-Slide Master Deck: 1 Title + 12 Core Slides + 1 Conclusion
 */

(function () {
  'use strict';

  // ── Global State ──────────────────────────────────────────
  const totalSlides = 14;
  let currentSlide = 0;

  // ── Scenario Data for Slide 12 (Deck Slide 13) ───────────
  const scenariosData = [
    {
      title: 'Baseline Urban Operations',
      subtitle: 'Steady-State Metropolitan Dispatch & Queue Equilibrium',
      badge: 'green',
      badgeText: 'Scenario 1: Baseline Flow',
      params: [
        '<strong>📌 Operational Stress:</strong> Poisson arrival process with rate λ = 0.4 calls/min across 36 intersections.',
        '<strong>⚡ Multi-Agent Action:</strong> Ambulances bid live Time-Dependent A* transit ETAs via Contract Net Protocol.',
        '<strong>🎯 Clinical Benchmark:</strong> Response time drops to 4.82 min with 0.00 min hospital offload delay and 100% specialty triage matching.'
      ],
      avgResp: '4.82 min',
      ramping: '0.00 min',
      matchRate: '100%',
      verdict: '<strong>🗣️ Read Aloud:</strong> "In baseline operations, Contract Net Protocol achieves continuous Nash equilibrium with zero resource starvation, maintaining an average response time of 4.82 minutes and 100% specialty triage matching."'
    },
    {
      title: 'Multi-Vehicle Highway Collision (MCI)',
      subtitle: 'Mass Casualty Surge with High-Acuity Priority Inundation',
      badge: 'red',
      badgeText: 'Scenario 2: Mass Casualty (MCI)',
      params: [
        '<strong>📌 Operational Stress:</strong> 6 simultaneous critical casualties (4 ESI-1, 2 ESI-2) clustered at Highway Node N10.',
        '<strong>⚡ Multi-Agent Action:</strong> Decentralized wave dispatch mobilizes full fleet + rapid motorcycle first responders simultaneously.',
        '<strong>🎯 Clinical Benchmark:</strong> All 6 victims cleared in 11.4 min vs 24.8 min for serial CAD (54% clearance speedup).'
      ],
      avgResp: '3.12 min',
      ramping: '0.00 min',
      matchRate: '100%',
      verdict: '<strong>🗣️ Read Aloud:</strong> "During mass casualty surge, our multi-agent wave dispatch evacuated all 6 critical victims in 11.4 minutes compared to 24.8 minutes under legacy serial CAD—achieving a 54% disaster clearance speedup."'
    },
    {
      title: 'Hospital Bed Crisis & ER Diversion',
      subtitle: 'Catastrophic ED Saturation Avoidance via Dynamic Gale-Shapley Matching',
      badge: 'purple',
      badgeText: 'Scenario 3: ED Bed Saturation',
      params: [
        '<strong>📌 Operational Stress:</strong> Central Hospital H1 reaches 95% bed capacity saturation (19/20 beds occupied).',
        '<strong>⚡ Multi-Agent Action:</strong> Gale-Shapley matching triggers proactive diversion at 85% threshold, rerouting to St. Jude & City General.',
        '<strong>🎯 Clinical Benchmark:</strong> Completely eliminates ambulance offload ramping (saving 22 min per crew) with zero human intervention.'
      ],
      avgResp: '5.20 min',
      ramping: '0.00 min',
      matchRate: '100%',
      verdict: '<strong>🗣️ Read Aloud:</strong> "When Central Hospital reached 85% capacity, Gale-Shapley dynamically diverted incoming ambulances to secondary facilities, saving 22 minutes per crew and eliminating hospital ramping without central human intervention."'
    },
    {
      title: 'Severe Weather Grid Storm',
      subtitle: 'Catastrophic Road Failures with Dynamic A* / D* Lite Rerouting',
      badge: 'amber',
      badgeText: 'Scenario 4: Severe Grid Storm',
      params: [
        '<strong>📌 Operational Stress:</strong> Storm closes 3 arterial roads; throughput drops 50%; peak congestion delay multiplier reaches 3.5×.',
        '<strong>⚡ Multi-Agent Action:</strong> D* Lite incremental search repairs disrupted graph routes in 1.4 ms without full graph recomputation.',
        '<strong>🎯 Clinical Benchmark:</strong> Ambulances bypass flooded choke points, avoiding the 28+ min gridlock delays suffered by static routing.'
      ],
      avgResp: '6.45 min',
      ramping: '0.00 min',
      matchRate: '98.5%',
      verdict: '<strong>🗣️ Read Aloud:</strong> "When severe storm shocks closed 3 arterial roads, D* Lite incrementally replanned routes in 1.4 milliseconds, averting the 28+ minute gridlock delays that crippled legacy static CAD ambulances."'
    }
  ];

  // ── Publication Plot Captions for Slide 12 (Deck Slide 13) ───
  const plotCaptions = {
    'plots/response_time_comparison.png': '<strong>🗣️ Figure 1 Talking Point:</strong> "Notice how as patient urgency escalates from ESI-5 to critical ESI-1, AURA-EMS prioritizes resources aggressively, cutting response time from 8.32 down to 1.83 minutes—a <strong>78% speedup</strong> well within the 5-minute brain-death window."',
    'plots/offload_delay_reduction.png': '<strong>🗣️ Figure 2 Talking Point:</strong> "This figure proves the complete collapse of Emergency Department ambulance ramping to exactly <strong>0.00 minutes</strong> across all simulation hours via pre-arrival Gale-Shapley bed reservation."',
    'plots/specialty_matching_rate.png': '<strong>🗣️ Figure 3 Talking Point:</strong> "This plot confirms <strong>100% specialty matching accuracy</strong>. Critical STEMI cardiac and neuro-trauma cases are routed directly to equipped Cath Labs and Trauma Bays without secondary transfers."',
    'plots/mci_disaster_clearance.png': '<strong>🗣️ Figure 4 Talking Point:</strong> "Here we compare disaster evacuation timelines. Legacy serial CAD took 24.8 minutes to clear 6 casualties, whereas our multi-agent parallel wave dispatch cleared the scene in <strong>11.4 minutes (54% speedup)</strong>."'
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
    setupMathTypesetting();
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
      } else if (e.key === 'Home') {
        goToSlide(0);
      } else if (e.key === 'End') {
        goToSlide(totalSlides - 1);
      } else if (e.key >= '1' && e.key <= '9') {
        goToSlide(parseInt(e.key, 10) - 1);
      } else if (e.key === '0') {
        goToSlide(9);
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
  // SLIDE 12: SCENARIO SWITCHER
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
        if (verdictEl) verdictEl.innerHTML = data.verdict;
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 12: PUBLICATION PLOT GALLERY
  // ══════════════════════════════════════════════════════════
  function setupPlotGallery() {
    const plotBtns = document.querySelectorAll('.plot-tab-btn');
    const plotThumbs = document.querySelectorAll('.plot-thumb-card');
    const plotImg = document.getElementById('activePlotImg');
    const plotCaption = document.getElementById('plotCaption');

    function selectPlot(src, title) {
      plotBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-plot') === src));
      plotThumbs.forEach(t => t.classList.toggle('active', t.getAttribute('data-plot') === src));

      if (plotImg && src) {
        plotImg.src = src;
        plotImg.alt = title || 'Publication Plot';
        if (plotCaption) {
          plotCaption.innerHTML = plotCaptions[src] || title;
        }
      }
    }

    plotBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const src = btn.getAttribute('data-plot');
        selectPlot(src, btn.textContent);
      });
    });

    plotThumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const src = thumb.getAttribute('data-plot');
        const title = thumb.querySelector('.thumb-title')?.textContent;
        selectPlot(src, title);
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 14: VIVA ACCORDION
  // ══════════════════════════════════════════════════════════
  function setupVivaAccordion() {
    const items = document.querySelectorAll('.viva-item');
    items.forEach((item) => {
      const header = item.querySelector('.viva-header');
      if (header) {
        header.addEventListener('click', () => {
          item.classList.toggle('open');
        });
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // MATHEMATICAL TYPESETTING (KaTeX Auto-Render)
  // ══════════════════════════════════════════════════════════
  function setupMathTypesetting() {
    function renderMath() {
      if (typeof renderMathInElement === 'function') {
        renderMathInElement(document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      }
    }

    if (typeof renderMathInElement === 'function') {
      renderMath();
    } else {
      window.addEventListener('load', renderMath);
    }
  }

})();
