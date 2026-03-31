/**
 * Offline Ark - Search Module
 * Builds a search index from guide data with fuzzy matching, result
 * highlighting, keyboard navigation, and localStorage caching.
 * Works entirely offline.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'offline-ark-search-index';
  var STORAGE_VERSION_KEY = 'offline-ark-search-version';
  var INDEX_VERSION = '2';

  // ------------------------------------------------------------------
  // Search data - one entry per guide. Extend this array as guides are
  // added to the project.
  // ------------------------------------------------------------------
  var searchData = [
    {
      id: 'ollama',
      title: 'Ollama — LLMs lokal betreiben',
      description: 'Künstliche Intelligenz auf deinem eigenen Rechner. ChatGPT-Alternative komplett offline, Modelle herunterladen und lokal chatten.',
      category: 'KI Offline',
      tags: ['ki', 'ai', 'llm', 'ollama', 'chatgpt', 'lokal', 'modell', 'chat', 'künstliche intelligenz'],
      url: '/guides/ai/ollama.html'
    },
    {
      id: 'kiwix',
      title: 'Kiwix — Wikipedia offline',
      description: 'Die komplette Wikipedia und andere Webseiten offline auf deinem Gerät. Millionen Artikel ohne Internet.',
      category: 'Wissen Sichern',
      tags: ['kiwix', 'wikipedia', 'offline', 'wissen', 'enzyklopädie', 'zim', 'bibliothek', 'nachschlagen'],
      url: '/guides/knowledge/kiwix.html'
    },
    {
      id: 'keepassxc',
      title: 'KeePassXC — Passwort-Manager offline',
      description: 'Sichere deine Passwörter in einem verschlüsselten Tresor. Komplett offline, ohne Cloud, ohne monatliche Kosten.',
      category: 'Sicherheit',
      tags: ['keepassxc', 'passwort', 'password', 'manager', 'tresor', 'verschlüsselung', 'sicherheit', 'kdbx'],
      url: '/guides/security/keepassxc.html'
    },
    {
      id: 'veracrypt',
      title: 'VeraCrypt — Festplatten verschlüsseln',
      description: 'Verschlüssele Festplatten, USB-Sticks und Dateien mit militärstarker AES-256 Verschlüsselung.',
      category: 'Sicherheit',
      tags: ['veracrypt', 'verschlüsselung', 'encryption', 'festplatte', 'usb', 'aes', 'container', 'sicherheit'],
      url: '/guides/security/veracrypt.html'
    },
    {
      id: 'localsend',
      title: 'LocalSend — Dateien teilen ohne Internet',
      description: 'Dateien zwischen Geräten teilen ohne Internet und ohne Cloud. Funktioniert mit allen Betriebssystemen im lokalen Netzwerk.',
      category: 'Kommunikation',
      tags: ['localsend', 'dateien', 'teilen', 'share', 'airdrop', 'p2p', 'lokal', 'netzwerk', 'senden'],
      url: '/guides/communication/localsend.html'
    },
    {
      id: 'osmand',
      title: 'OsmAnd — Offline-Karten und Navigation',
      description: 'Offline navigieren mit OpenStreetMap. Komplette Länder herunterladen, Wandern, Radfahren, Auto — ohne Internet.',
      category: 'Navigation',
      tags: ['osmand', 'karten', 'maps', 'navigation', 'openstreetmap', 'osm', 'offline', 'wandern', 'route'],
      url: '/guides/navigation/osmand.html'
    },
    {
      id: 'jellyfin',
      title: 'Jellyfin — Eigener Streaming-Server',
      description: 'Dein eigener Streaming-Server für Filme, Serien und Musik. Wie Netflix, aber lokal und kostenlos.',
      category: 'Medien',
      tags: ['jellyfin', 'streaming', 'filme', 'serien', 'musik', 'media', 'server', 'plex', 'video'],
      url: '/guides/media/jellyfin.html'
    },
    {
      id: 'obsidian',
      title: 'Obsidian — Notizen offline organisieren',
      description: 'Notizen, Ideen und Wissen in einer lokalen Wissensdatenbank organisieren. Markdown-basiert, komplett offline.',
      category: 'Produktivität',
      tags: ['obsidian', 'notizen', 'notes', 'markdown', 'wissen', 'vault', 'produktivität', 'wiki'],
      url: '/guides/productivity/obsidian.html'
    },
    {
      id: 'beginner-checklist',
      title: 'Beginner-Checkliste',
      description: 'Deine ersten 5 Offline-Tools Schritt für Schritt. Passwörter, Wikipedia, KI, Dateien teilen und Notizen.',
      category: 'Checklisten',
      tags: ['beginner', 'anfänger', 'checkliste', 'start', 'einstieg', 'erste schritte'],
      url: '/guides/checklists/beginner.html'
    }
  ];

  // ------------------------------------------------------------------
  // Index building
  // ------------------------------------------------------------------

  /**
   * Build a flat search corpus string for each entry so we only do this
   * work once.
   */
  function buildIndex(data) {
    return data.map(function (entry) {
      var corpus = [
        entry.title,
        entry.description,
        entry.category,
        (entry.tags || []).join(' ')
      ]
        .join(' ')
        .toLowerCase();
      return {
        entry: entry,
        corpus: corpus
      };
    });
  }

  /**
   * Persist the index to localStorage.
   */
  function saveIndex(index) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(index));
      localStorage.setItem(STORAGE_VERSION_KEY, INDEX_VERSION);
    } catch (e) {
      // Storage full or unavailable - degrade gracefully.
    }
  }

  /**
   * Load index from localStorage if the version matches.
   */
  function loadIndex() {
    try {
      if (localStorage.getItem(STORAGE_VERSION_KEY) === INDEX_VERSION) {
        var stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      // Parse error or storage unavailable.
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Search algorithm
  // ------------------------------------------------------------------

  /**
   * Perform a fuzzy search. Returns an array of { entry, score } sorted
   * by relevance (highest score first).
   *
   * Strategy:
   *   1. Tokenise query into lowercase words.
   *   2. For each token, check partial (substring) match in the corpus.
   *   3. Exact word-boundary matches score higher than substring matches.
   *   4. Title matches score higher than description/tag matches.
   */
  function search(index, query) {
    if (!query || !query.trim()) {
      return [];
    }

    var tokens = query
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(function (t) {
        return t.length > 0;
      });

    if (tokens.length === 0) {
      return [];
    }

    var results = [];

    for (var i = 0; i < index.length; i++) {
      var item = index[i];
      var score = 0;
      var matched = true;

      for (var t = 0; t < tokens.length; t++) {
        var token = tokens[t];
        var titleLower = item.entry.title.toLowerCase();

        if (item.corpus.indexOf(token) === -1) {
          matched = false;
          break;
        }

        // Exact word match in title = high score
        if (titleLower.indexOf(token) !== -1) {
          score += 10;
          // Bonus if the title starts with the token
          if (titleLower.indexOf(token) === 0) {
            score += 5;
          }
        }

        // Word-boundary match (whole word) scores more than substring
        var wordBoundary = new RegExp('\\b' + escapeRegex(token) + '\\b');
        if (wordBoundary.test(item.corpus)) {
          score += 3;
        }

        // Baseline for substring match
        score += 1;
      }

      if (matched && score > 0) {
        results.push({ entry: item.entry, score: score });
      }
    }

    results.sort(function (a, b) {
      return b.score - a.score;
    });

    return results;
  }

  // ------------------------------------------------------------------
  // Highlighting
  // ------------------------------------------------------------------

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /**
   * Wrap matched query terms in <mark> tags within the given text.
   */
  function highlight(text, query) {
    if (!query || !query.trim()) {
      return escapeHtml(text);
    }

    var tokens = query
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(function (t) {
        return t.length > 0;
      });

    var escaped = escapeHtml(text);

    tokens.forEach(function (token) {
      var re = new RegExp('(' + escapeRegex(token) + ')', 'gi');
      escaped = escaped.replace(re, '<mark>$1</mark>');
    });

    return escaped;
  }

  // ------------------------------------------------------------------
  // UI rendering
  // ------------------------------------------------------------------

  var activeIndex = -1;
  var currentResults = [];

  function getDropdown(searchInput) {
    var existing = searchInput.parentNode.querySelector('.search-dropdown');
    if (existing) {
      return existing;
    }
    var dropdown = document.createElement('div');
    dropdown.className = 'search-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-label', 'Search results');
    searchInput.parentNode.style.position = 'relative';
    searchInput.parentNode.appendChild(dropdown);
    return dropdown;
  }

  function renderResults(searchInput, results, query) {
    var dropdown = getDropdown(searchInput);
    currentResults = results;
    activeIndex = -1;

    if (results.length === 0 && query && query.trim().length > 0) {
      dropdown.innerHTML =
        '<div class="search-no-results">No results found</div>';
      dropdown.classList.add('active');
      return;
    }

    if (results.length === 0) {
      dropdown.innerHTML = '';
      dropdown.classList.remove('active');
      return;
    }

    var html = '';
    var limit = Math.min(results.length, 8);
    for (var i = 0; i < limit; i++) {
      var r = results[i];
      html +=
        '<a href="' +
        escapeHtml(r.entry.url) +
        '" class="search-result-item" role="option" data-index="' +
        i +
        '">' +
        '<span class="search-result-title">' +
        highlight(r.entry.title, query) +
        '</span>' +
        '<span class="search-result-category">' +
        escapeHtml(r.entry.category) +
        '</span>' +
        '<span class="search-result-desc">' +
        highlight(r.entry.description, query) +
        '</span>' +
        '</a>';
    }

    dropdown.innerHTML = html;
    dropdown.classList.add('active');
  }

  function clearResults(searchInput) {
    var dropdown = getDropdown(searchInput);
    dropdown.innerHTML = '';
    dropdown.classList.remove('active');
    currentResults = [];
    activeIndex = -1;
  }

  function setActiveItem(dropdown, index) {
    var items = dropdown.querySelectorAll('.search-result-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('active');
      items[i].setAttribute('aria-selected', 'false');
    }
    if (index >= 0 && index < items.length) {
      items[index].classList.add('active');
      items[index].setAttribute('aria-selected', 'true');
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  // ------------------------------------------------------------------
  // Keyboard navigation
  // ------------------------------------------------------------------

  function handleKeydown(event, searchInput) {
    var dropdown = getDropdown(searchInput);
    var items = dropdown.querySelectorAll('.search-result-item');
    var count = items.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        activeIndex = activeIndex < count - 1 ? activeIndex + 1 : 0;
        setActiveItem(dropdown, activeIndex);
        break;

      case 'ArrowUp':
        event.preventDefault();
        activeIndex = activeIndex > 0 ? activeIndex - 1 : count - 1;
        setActiveItem(dropdown, activeIndex);
        break;

      case 'Enter':
        if (activeIndex >= 0 && activeIndex < count) {
          event.preventDefault();
          items[activeIndex].click();
        }
        break;

      case 'Escape':
        clearResults(searchInput);
        searchInput.blur();
        break;
    }
  }

  // ------------------------------------------------------------------
  // Initialization
  // ------------------------------------------------------------------

  function initSearch() {
    var searchInput = document.querySelector('#search-input');
    if (!searchInput) {
      return;
    }

    // Build or load index.
    var index = loadIndex();
    if (!index) {
      index = buildIndex(searchData);
      saveIndex(index);
    }

    // Debounce helper.
    var debounceTimer = null;
    function debounce(fn, delay) {
      return function () {
        var args = arguments;
        var context = this;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          fn.apply(context, args);
        }, delay);
      };
    }

    var onInput = debounce(function () {
      var query = searchInput.value;
      if (!query || query.trim().length < 2) {
        clearResults(searchInput);
        return;
      }
      var results = search(index, query);
      renderResults(searchInput, results, query);
    }, 150);

    searchInput.addEventListener('input', onInput);

    searchInput.addEventListener('keydown', function (event) {
      handleKeydown(event, searchInput);
    });

    // Close dropdown when clicking outside.
    document.addEventListener('click', function (event) {
      if (!searchInput.parentNode.contains(event.target)) {
        clearResults(searchInput);
      }
    });

    // Re-open on focus if there is a query.
    searchInput.addEventListener('focus', function () {
      if (searchInput.value && searchInput.value.trim().length >= 2) {
        var results = search(index, searchInput.value);
        renderResults(searchInput, results, searchInput.value);
      }
    });

    searchInput.setAttribute('aria-haspopup', 'listbox');
    searchInput.setAttribute('aria-autocomplete', 'list');
    searchInput.setAttribute('autocomplete', 'off');
  }

  // Expose for app.js.
  window.OfflineArkSearch = {
    init: initSearch,
    searchData: searchData
  };
})();
