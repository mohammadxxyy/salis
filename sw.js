// Service Worker for Salis PWA - Version 3 (Network-First for HTML, Cache-First for Assets, Full Auto-Update)
const CACHE_NAME = 'salis-v3-2026';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/logo.jpg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Immediately activate new SW
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim()) // Immediately take control of all open tabs/PWA
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isNavigation = e.request.mode === 'navigate' || 
                       (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) ||
                       url.pathname.endsWith('index.html') ||
                       url.pathname === '/' ||
                       url.pathname.endsWith('/');

  // 1. Navigation (HTML App Shell): Network-First with Cache Fallback
  // Guarantees immediate updates when online, 100% offline resilience when offline.
  if (isNavigation) {
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match('./index.html') || caches.match('./');
      })
    );
    return;
  }

  // 2. Static Assets & CDNs: Cache-First with Dynamic Cache Fallback
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.log('[SW] Fetch failed for:', e.request.url);
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});
