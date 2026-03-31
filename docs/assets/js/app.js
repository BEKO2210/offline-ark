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
      var tabs = container.querySelectorAll('.tab-btn');
      var panels = container.querySelectorAll('.tab-content');

      function activate(platform) {
        tabs.forEach(function (tab) {
          var isActive = tab.getAttribute('data-tab') === platform;
          tab.classList.toggle('active', isActive);
          tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panels.forEach(function (panel) {
          var panelId = panel.getAttribute('id');
          var isActive = panelId === 'tab-' + platform;
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
        tab.addEventListener('click', function () {
          var platform = tab.getAttribute('data-tab');
          if (platform) {
            activate(platform);
          }
        });
      });

      // Restore saved selection or default to the first tab.
      if (savedPlatform) {
        var hasTab = container.querySelector(
          '[data-tab="' + savedPlatform + '"]'
        );
        if (hasTab) {
          activate(savedPlatform);
          return;
        }
      }

      var firstTab = tabs[0];
      if (firstTab) {
        activate(firstTab.getAttribute('data-tab'));
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
    var toggleBtn = document.querySelector('.hamburger, .nav-toggle');
    var navMenu = document.querySelector('#main-nav, .nav-menu, .mobile-nav');
    var overlay = document.querySelector('.nav-overlay');

    if (!toggleBtn || !navMenu) return;

    // Touch event handling for better mobile response
    var touchStartX = 0;
    var touchEndX = 0;
    var touchStartY = 0;
    var touchEndY = 0;

    function openMenu() {
      navMenu.classList.add('active', 'open');
      toggleBtn.classList.add('active', 'open');
      toggleBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('nav-open');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      if (overlay) overlay.classList.add('active', 'visible');
      
      // Focus first link for accessibility
      var firstLink = navMenu.querySelector('a');
      if (firstLink) firstLink.focus();
    }

    function closeMenu() {
      navMenu.classList.remove('active', 'open');
      toggleBtn.classList.remove('active', 'open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
      document.body.style.overflow = ''; // Restore scrolling
      if (overlay) overlay.classList.remove('active', 'visible');
      toggleBtn.focus();
    }

    function toggleMenu() {
      if (navMenu.classList.contains('active') || navMenu.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    }

    // Click handler
    toggleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });

    // Touch handlers for swipe gesture
    document.addEventListener('touchstart', function(e) {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipe();
    }, { passive: true });

    function handleSwipe() {
      var swipeThreshold = 80;
      var horizontalDiff = touchEndX - touchStartX;
      var verticalDiff = Math.abs(touchEndY - touchStartY);
      
      // Swipe left to close menu
      if (horizontalDiff < -swipeThreshold && verticalDiff < 100) {
        if (navMenu.classList.contains('active') || navMenu.classList.contains('open')) {
          closeMenu();
        }
      }
      
      // Swipe right from edge to open menu
      if (horizontalDiff > swipeThreshold && verticalDiff < 100 && touchStartX < 30) {
        if (!navMenu.classList.contains('active') && !navMenu.classList.contains('open')) {
          openMenu();
        }
      }
    }

    if (overlay) {
      overlay.addEventListener('click', closeMenu);
      overlay.addEventListener('touchstart', closeMenu, { passive: true });
    }

    // Close menu when a nav link is clicked.
    var navLinks = navMenu.querySelectorAll('a');
    navLinks.forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    // Close menu on Escape.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && (navMenu.classList.contains('active') || navMenu.classList.contains('open'))) {
        closeMenu();
      }
    });

    // Close menu when viewport becomes wide enough.
    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: 768px)');
      var handleMediaChange = function(mq) {
        if (mq.matches) {
          closeMenu();
        }
      };
      
      // Modern browsers
      if (mq.addEventListener) {
        mq.addEventListener('change', handleMediaChange);
      } else {
        // Legacy support
        mq.addListener(handleMediaChange);
      }
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
