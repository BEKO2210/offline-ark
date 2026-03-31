/**
 * Offline Ark - Service Worker
 * Provides offline-first caching with cache-first strategy.
 */

const CACHE_VERSION = 2;
const CACHE_NAME = 'offline-ark-v' + CACHE_VERSION;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/fonts.css',
  '/assets/css/main.css',
  '/assets/css/animations.css',
  '/assets/js/app.js',
  '/assets/js/search.js',
  '/assets/js/progress.js',
  '/assets/js/clipboard.js'
];

/**
 * Install event - pre-cache core assets.
 */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS).catch(function (error) {
        console.warn('[SW] Pre-cache failed for some assets:', error);
        // Cache what we can individually so a single missing file
        // does not break the entire install.
        return Promise.allSettled(
          CORE_ASSETS.map(function (url) {
            return cache.add(url).catch(function () {
              console.warn('[SW] Could not cache:', url);
            });
          })
        );
      });
    })
  );
  // Activate immediately without waiting for existing clients to close.
  self.skipWaiting();
});

/**
 * Activate event - purge old caches that do not match the current version.
 */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) {
            return name.startsWith('offline-ark-') && name !== CACHE_NAME;
          })
          .map(function (name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function () {
      // Claim all open clients so the new SW controls them immediately.
      return self.clients.claim();
    })
  );
});

/**
 * Determine whether a request is a navigation request (HTML page load).
 */
function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' &&
      request.headers.get('accept') &&
      request.headers.get('accept').indexOf('text/html') !== -1)
  );
}

/**
 * Fetch event - cache-first strategy with network fallback.
 * Navigation requests fall back to /index.html when offline so the
 * single-page shell can render an offline-friendly view.
 */
self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Only handle GET requests.
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cachedResponse) {
      if (cachedResponse) {
        // Return from cache and update the cache in the background.
        refreshCache(request);
        return cachedResponse;
      }

      // Not in cache - try the network.
      return fetchAndCache(request).catch(function () {
        // Network failed. For navigation requests serve the cached shell.
        if (isNavigationRequest(request)) {
          return caches.match('/index.html');
        }
        // For other resources there is nothing we can do.
        return new Response('', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});

/**
 * Fetch from the network and store the response in the cache.
 */
function fetchAndCache(request) {
  return fetch(request).then(function (networkResponse) {
    // Only cache successful responses from our own origin.
    if (
      networkResponse &&
      networkResponse.status === 200 &&
      networkResponse.type === 'basic'
    ) {
      var responseClone = networkResponse.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(request, responseClone);
      });
    }
    return networkResponse;
  });
}

/**
 * Silently refresh a cached asset from the network so the cache stays
 * up-to-date for the next visit.
 */
function refreshCache(request) {
  fetch(request)
    .then(function (networkResponse) {
      if (
        networkResponse &&
        networkResponse.status === 200 &&
        networkResponse.type === 'basic'
      ) {
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, networkResponse);
        });
      }
    })
    .catch(function () {
      // Network unavailable - ignore silently.
    });
}

/**
 * Listen for messages from the main thread.
 * Supports a manual "skipWaiting" trigger so the app can prompt users
 * to activate a new version.
 */
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
