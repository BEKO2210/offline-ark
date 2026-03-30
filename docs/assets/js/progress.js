/**
 * Offline Ark - Progress Tracking Module
 * Tracks completed steps per guide via localStorage and exposes
 * functions to query / update progress. Dispatches custom events
 * so other parts of the UI can react.
 */
(function () {
  'use strict';

  var STORAGE_PREFIX = 'progress-';
  var PROGRESS_CHANGE_EVENT = 'offlineark:progress';

  // ------------------------------------------------------------------
  // localStorage helpers
  // ------------------------------------------------------------------

  function readProgress(guideId) {
    try {
      var raw = localStorage.getItem(STORAGE_PREFIX + guideId);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      // Corrupt data - reset.
    }
    return {};
  }

  function writeProgress(guideId, data) {
    try {
      localStorage.setItem(STORAGE_PREFIX + guideId, JSON.stringify(data));
    } catch (e) {
      // Storage full or unavailable.
    }
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /**
   * Return the progress object for a single guide.
   * Shape: { completed: number, total: number, steps: { [index]: boolean } }
   */
  function getGuideProgress(guideId) {
    var data = readProgress(guideId);
    var steps = data.steps || {};
    var total = data.total || 0;
    var completed = 0;

    Object.keys(steps).forEach(function (key) {
      if (steps[key]) {
        completed++;
      }
    });

    return {
      completed: completed,
      total: total,
      steps: steps,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  /**
   * Mark a single step as complete or incomplete.
   */
  function setStepComplete(guideId, stepIndex, complete) {
    var data = readProgress(guideId);
    if (!data.steps) {
      data.steps = {};
    }
    data.steps[stepIndex] = !!complete;
    writeProgress(guideId, data);

    dispatchProgressEvent(guideId);
  }

  /**
   * Compute overall progress across every tracked guide.
   * Returns { completed, total, percent, guides: { [id]: progressObj } }
   */
  function getOverallProgress() {
    var guides = {};
    var totalCompleted = 0;
    var totalSteps = 0;

    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(STORAGE_PREFIX) === 0) {
        var guideId = key.slice(STORAGE_PREFIX.length);
        var prog = getGuideProgress(guideId);
        guides[guideId] = prog;
        totalCompleted += prog.completed;
        totalSteps += prog.total;
      }
    }

    return {
      completed: totalCompleted,
      total: totalSteps,
      percent: totalSteps > 0 ? Math.round((totalCompleted / totalSteps) * 100) : 0,
      guides: guides
    };
  }

  // ------------------------------------------------------------------
  // Events
  // ------------------------------------------------------------------

  function dispatchProgressEvent(guideId) {
    var detail = {
      guideId: guideId,
      progress: getGuideProgress(guideId),
      overall: getOverallProgress()
    };

    var event;
    if (typeof CustomEvent === 'function') {
      event = new CustomEvent(PROGRESS_CHANGE_EVENT, { detail: detail });
    } else {
      // IE11 fallback
      event = document.createEvent('CustomEvent');
      event.initCustomEvent(PROGRESS_CHANGE_EVENT, true, true, detail);
    }
    document.dispatchEvent(event);
  }

  // ------------------------------------------------------------------
  // DOM binding
  // ------------------------------------------------------------------

  /**
   * Discover all step checkboxes on the page, wire them up, and restore
   * their saved state.
   *
   * Expected markup:
   *   <input type="checkbox" class="step-checkbox"
   *          data-guide="water-purification" data-step="0">
   */
  function bindCheckboxes() {
    var checkboxes = document.querySelectorAll('.step-checkbox');
    checkboxes.forEach(function (cb) {
      var guideId = cb.getAttribute('data-guide');
      var stepIndex = cb.getAttribute('data-step');
      if (!guideId || stepIndex === null) {
        return;
      }

      // Ensure total is tracked.
      var data = readProgress(guideId);
      var totalOnPage = document.querySelectorAll(
        '.step-checkbox[data-guide="' + guideId + '"]'
      ).length;
      if (!data.total || data.total < totalOnPage) {
        data.total = totalOnPage;
        if (!data.steps) {
          data.steps = {};
        }
        writeProgress(guideId, data);
      }

      // Restore state.
      var progress = getGuideProgress(guideId);
      if (progress.steps[stepIndex]) {
        cb.checked = true;
      }

      // Listen for changes.
      cb.addEventListener('change', function () {
        setStepComplete(guideId, stepIndex, cb.checked);
        updateProgressBars();
      });
    });
  }

  /**
   * Update all progress bar elements on the page.
   *
   * Expected markup:
   *   <div class="progress-bar" data-guide="water-purification">
   *     <div class="progress-bar-fill"></div>
   *     <span class="progress-bar-text"></span>
   *   </div>
   *
   * For the overall progress bar, use data-guide="overall".
   */
  function updateProgressBars() {
    var bars = document.querySelectorAll('.progress-bar');
    var overall = getOverallProgress();

    bars.forEach(function (bar) {
      var guideId = bar.getAttribute('data-guide');
      var prog;

      if (guideId === 'overall') {
        prog = overall;
      } else {
        prog = getGuideProgress(guideId);
      }

      var fill = bar.querySelector('.progress-bar-fill');
      var text = bar.querySelector('.progress-bar-text');

      if (fill) {
        fill.style.width = prog.percent + '%';
      }
      if (text) {
        text.textContent = prog.completed + ' / ' + prog.total + ' (' + prog.percent + '%)';
      }

      bar.setAttribute('aria-valuenow', prog.percent);
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
    });

    // Also update any overall-progress summary elements.
    var summaries = document.querySelectorAll('.overall-progress-text');
    summaries.forEach(function (el) {
      el.textContent =
        overall.completed +
        ' of ' +
        overall.total +
        ' steps completed (' +
        overall.percent +
        '%)';
    });
  }

  // ------------------------------------------------------------------
  // Initialization
  // ------------------------------------------------------------------

  function initProgress() {
    bindCheckboxes();
    updateProgressBars();

    // Re-render when progress changes (from other tabs via storage event).
    window.addEventListener('storage', function (event) {
      if (event.key && event.key.indexOf(STORAGE_PREFIX) === 0) {
        updateProgressBars();
      }
    });
  }

  // Expose for app.js.
  window.OfflineArkProgress = {
    init: initProgress,
    getGuideProgress: getGuideProgress,
    setStepComplete: setStepComplete,
    getOverallProgress: getOverallProgress,
    updateProgressBars: updateProgressBars
  };
})();
