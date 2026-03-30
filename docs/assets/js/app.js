/**
 * Offline Ark - Main Application
 * Orchestrates all modules and UI behaviours.
 */
(function () {
  'use strict';

  // ==================================================================
  // 1. Service Worker Registration
  // ==================================================================

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register('/assets/js/sw.js', { scope: '/' })
      .then(function (registration) {
        console.log('[App] Service Worker registered, scope:', registration.scope);

        // Notify the user when a new version is available.
        registration.addEventListener('updatefound', function () {
          var newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', function () {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              showUpdateBanner(registration);
            }
          });
        });
      })
      .catch(function (error) {
        console.warn('[App] Service Worker registration failed:', error);
      });

    // If the controller changes (new SW activated), reload for fresh assets.
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  function showUpdateBanner(registration) {
    var banner = document.querySelector('.update-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'update-banner';
      banner.innerHTML =
        '<p>A new version is available.</p>' +
        '<button class="update-btn" type="button">Update now</button>' +
        '<button class="update-dismiss" type="button" aria-label="Dismiss">&times;</button>';
      document.body.appendChild(banner);
    }

    banner.classList.add('visible');

    var updateBtn = banner.querySelector('.update-btn');
    var dismissBtn = banner.querySelector('.update-dismiss');

    updateBtn.addEventListener('click', function () {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });

    dismissBtn.addEventListener('click', function () {
      banner.classList.remove('visible');
    });
  }

  // ==================================================================
  // 2. Scroll Reveal (IntersectionObserver)
  // ==================================================================

  function initScrollReveal() {
    var elements = document.querySelectorAll('.scroll-reveal');
    if (elements.length === 0) return;

    if (!('IntersectionObserver' in window)) {
      // Fallback: make everything visible immediately.
      elements.forEach(function (el) {
        el.classList.add('visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach(function (el) {
      observer.observe(el);
    });
  }

  // ==================================================================
  // 3. Platform / OS Tabs
  // ==================================================================

  var PLATFORM_STORAGE_KEY = 'offline-ark-platform';

  function initPlatformTabs() {
    var tabContainers = document.querySelectorAll('.platform-tabs');
    if (tabContainers.length === 0) return;

    var savedPlatform = null;
    try {
      savedPlatform = localStorage.getItem(PLATFORM_STORAGE_KEY);
    } catch (e) {
      // Ignore.
    }

    tabContainers.forEach(function (container) {
      var tabs = container.querySelectorAll('.platform-tab');
      var panels = container.parentNode.querySelectorAll('.platform-panel');

      function activate(platform) {
        tabs.forEach(function (tab) {
          var isActive = tab.getAttribute('data-platform') === platform;
          tab.classList.toggle('active', isActive);
          tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panels.forEach(function (panel) {
          var isActive = panel.getAttribute('data-platform') === platform;
          panel.classList.toggle('active', isActive);
          panel.hidden = !isActive;
        });

        try {
          localStorage.setItem(PLATFORM_STORAGE_KEY, platform);
        } catch (e) {
          // Ignore.
        }
      }

      tabs.forEach(function (tab) {
        tab.setAttribute('role', 'tab');
        tab.addEventListener('click', function () {
          var platform = tab.getAttribute('data-platform');
          if (platform) {
            activate(platform);
          }
        });
      });

      // Restore saved selection or default to the first tab.
      if (savedPlatform) {
        var hasTab = container.querySelector(
          '[data-platform="' + savedPlatform + '"]'
        );
        if (hasTab) {
          activate(savedPlatform);
          return;
        }
      }

      var firstTab = tabs[0];
      if (firstTab) {
        activate(firstTab.getAttribute('data-platform'));
      }
    });
  }

  // ==================================================================
  // 4. Theme Toggle (Dark / Light)
  // ==================================================================

  var THEME_STORAGE_KEY = 'offline-ark-theme';

  function getPreferredTheme() {
    try {
      var stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (e) {
      // Ignore.
    }

    if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      // Ignore.
    }

    // Update toggle button state if present.
    var toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(function (btn) {
      var isDark = theme === 'dark';
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  function initThemeToggle() {
    // Apply theme immediately (before DOMContentLoaded to prevent flash).
    applyTheme(getPreferredTheme());

    var toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme') || 'light';
        applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    });

    // Respond to OS-level theme changes.
    if (window.matchMedia) {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', function (event) {
          // Only auto-switch if the user has not explicitly chosen.
          try {
            if (!localStorage.getItem(THEME_STORAGE_KEY)) {
              applyTheme(event.matches ? 'dark' : 'light');
            }
          } catch (e) {
            applyTheme(event.matches ? 'dark' : 'light');
          }
        });
    }
  }

  // ==================================================================
  // 5. Accordions / Collapsible Elements
  // ==================================================================

  function initAccordions() {
    var triggers = document.querySelectorAll('.accordion-trigger, .collapsible-trigger');
    triggers.forEach(function (trigger) {
      var targetId = trigger.getAttribute('aria-controls');
      var content = targetId
        ? document.getElementById(targetId)
        : trigger.nextElementSibling;

      if (!content) return;

      // Ensure ARIA attributes are set.
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('tabindex', '0');

      var isExpanded = trigger.getAttribute('aria-expanded') === 'true';
      content.hidden = !isExpanded;

      function toggle() {
        isExpanded = !isExpanded;
        trigger.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        content.hidden = !isExpanded;
        trigger.classList.toggle('expanded', isExpanded);
        content.classList.toggle('expanded', isExpanded);
      }

      trigger.addEventListener('click', toggle);
      trigger.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      });
    });
  }

  // ==================================================================
  // 6. Mobile Navigation (Hamburger Menu)
  // ==================================================================

  function initMobileNav() {
    var toggleBtn = document.querySelector('.nav-toggle, .hamburger');
    var navMenu = document.querySelector('.nav-menu, .mobile-nav');
    var overlay = document.querySelector('.nav-overlay');

    if (!toggleBtn || !navMenu) return;

    function openMenu() {
      navMenu.classList.add('open');
      toggleBtn.classList.add('open');
      toggleBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('nav-open');
      if (overlay) overlay.classList.add('visible');
    }

    function closeMenu() {
      navMenu.classList.remove('open');
      toggleBtn.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
      if (overlay) overlay.classList.remove('visible');
    }

    function toggleMenu() {
      if (navMenu.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    }

    toggleBtn.addEventListener('click', toggleMenu);

    if (overlay) {
      overlay.addEventListener('click', closeMenu);
    }

    // Close menu when a nav link is clicked.
    var navLinks = navMenu.querySelectorAll('a');
    navLinks.forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    // Close menu on Escape.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && navMenu.classList.contains('open')) {
        closeMenu();
        toggleBtn.focus();
      }
    });

    // Close menu when viewport becomes wide enough.
    if (window.matchMedia) {
      window.matchMedia('(min-width: 768px)').addEventListener('change', function (mq) {
        if (mq.matches) {
          closeMenu();
        }
      });
    }
  }

  // ==================================================================
  // 7. Smooth Scroll for Anchor Links
  // ==================================================================

  function initSmoothScroll() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) return;

      var targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;

      var target = document.querySelector(targetId);
      if (!target) return;

      event.preventDefault();

      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Update URL without triggering scroll.
      if (history.pushState) {
        history.pushState(null, '', targetId);
      }

      // Move focus for accessibility.
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  // ==================================================================
  // 8. External Module Initialization
  // ==================================================================

  function initSearch() {
    if (window.OfflineArkSearch && typeof window.OfflineArkSearch.init === 'function') {
      window.OfflineArkSearch.init();
    }
  }

  function initProgress() {
    if (window.OfflineArkProgress && typeof window.OfflineArkProgress.init === 'function') {
      window.OfflineArkProgress.init();
    }
  }

  function initClipboard() {
    if (window.OfflineArkClipboard && typeof window.OfflineArkClipboard.init === 'function') {
      window.OfflineArkClipboard.init();
    }
  }

  // ==================================================================
  // Bootstrap
  // ==================================================================

  // Apply theme as early as possible to prevent flash of wrong theme.
  applyTheme(getPreferredTheme());

  document.addEventListener('DOMContentLoaded', function () {
    registerServiceWorker();
    initScrollReveal();
    initPlatformTabs();
    initThemeToggle();
    initAccordions();
    initMobileNav();
    initSmoothScroll();
    initSearch();
    initProgress();
    initClipboard();

    console.log('[App] Offline Ark initialised.');
  });
})();
