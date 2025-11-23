/**
 * Printyx Service Worker
 * Provides offline capabilities and performance optimization through caching
 */

const CACHE_VERSION = 'printyx-v1.0.0';
const CACHE_NAME = `printyx-cache-${CACHE_VERSION}`;

// Core app shell files to cache on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// API endpoints to cache (with network-first strategy)
const API_CACHE_PATTERNS = [
  /\/api\/dashboard/,
  /\/api\/customers/,
  /\/api\/service-dispatch/,
  /\/api\/user/
];

// Static assets to cache (with cache-first strategy)
const STATIC_CACHE_PATTERNS = [
  /\.js$/,
  /\.css$/,
  /\.woff2?$/,
  /\.png$/,
  /\.jpg$/,
  /\.svg$/
];

/**
 * Install Event - Cache app shell
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => {
        console.log('[Service Worker] App shell cached successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[Service Worker] Cache installation failed:', error);
      })
  );
});

/**
 * Activate Event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old caches
              return cacheName.startsWith('printyx-cache-') && cacheName !== CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients');
        return self.clients.claim(); // Take control immediately
      })
  );
});

/**
 * Fetch Event - Serve from cache or network
 * Strategy: Network-first for API, Cache-first for static assets
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except for fonts/images)
  if (url.origin !== self.location.origin && !isStaticAsset(url.pathname)) {
    return;
  }

  // API requests: Network-first strategy
  if (isApiRequest(url.pathname)) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets: Cache-first strategy
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Navigation requests: Network-first with fallback to index.html
  if (request.mode === 'navigate') {
    event.respondWith(navigationStrategy(request));
    return;
  }

  // Default: Network-first
  event.respondWith(networkFirstStrategy(request));
});

/**
 * Network-First Strategy
 * Try network first, fall back to cache if offline
 */
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses (200-299)
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network request failed, trying cache:', request.url);

    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }

    // Return error response for other requests
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'You are currently offline. Please check your connection.'
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      }
    );
  }
}

/**
 * Cache-First Strategy
 * Serve from cache, update cache in background
 */
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Update cache in background (stale-while-revalidate)
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, networkResponse));
        }
      })
      .catch(() => {
        // Ignore network errors for background updates
      });

    return cachedResponse;
  }

  // Not in cache, fetch from network
  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

/**
 * Navigation Strategy
 * Network-first for HTML pages, fallback to index.html
 */
async function navigationStrategy(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Navigation request failed, serving cached index.html');

    const cachedResponse = await caches.match('/index.html');

    if (cachedResponse) {
      return cachedResponse;
    }

    // Last resort: offline page
    return new Response(
      `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Printyx - Offline</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-align: center;
              padding: 20px;
            }
            .container {
              max-width: 500px;
            }
            h1 {
              font-size: 3rem;
              margin-bottom: 1rem;
            }
            p {
              font-size: 1.2rem;
              margin-bottom: 2rem;
            }
            .retry-btn {
              background: white;
              color: #667eea;
              border: none;
              padding: 12px 32px;
              font-size: 1rem;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 600;
            }
            .retry-btn:hover {
              background: #f0f0f0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📡 You're Offline</h1>
            <p>Printyx requires an internet connection to load. Please check your connection and try again.</p>
            <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: new Headers({
          'Content-Type': 'text/html'
        })
      }
    );
  }
}

/**
 * Check if request is an API call
 */
function isApiRequest(pathname) {
  return pathname.startsWith('/api/') ||
         API_CACHE_PATTERNS.some(pattern => pattern.test(pathname));
}

/**
 * Check if request is a static asset
 */
function isStaticAsset(pathname) {
  return STATIC_CACHE_PATTERNS.some(pattern => pattern.test(pathname));
}

/**
 * Background Sync - Sync data when connection restored
 */
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);

  if (event.tag === 'sync-data') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  try {
    // Implement offline data sync logic here
    console.log('[Service Worker] Syncing offline data...');

    // Example: Sync queued actions from IndexedDB
    // const db = await openDatabase();
    // const queuedActions = await db.getAll('offline-queue');
    // await Promise.all(queuedActions.map(action => processAction(action)));

    console.log('[Service Worker] Offline data synced successfully');
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
    throw error; // Retry on next sync
  }
}

/**
 * Push Notifications
 */
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');

  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Printyx Notification';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: data.tag || 'default',
    data: data,
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/**
 * Notification Click
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.notification.tag);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

/**
 * Message Handler - Communication with app
 */
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(urls))
    );
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME)
        .then(() => {
          return caches.open(CACHE_NAME);
        })
    );
  }
});

console.log('[Service Worker] Loaded successfully');
