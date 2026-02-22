import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

clientsClaim();
self.skipWaiting();

cleanupOutdatedCaches();
const precacheManifest = (self.__WB_MANIFEST || []).filter((entry) => {
  const url = typeof entry === 'string' ? entry : entry.url;
  return (
    url !== '/firebase-messaging-sw.js' &&
    url !== '/firebase-config.js' &&
    !url.endsWith('/version.json')
  );
});
precacheAndRoute(precacheManifest);

const OFFLINE_URL = '/offline.html';

// HTML documents: always network, fall back to offline page.
registerRoute(
  ({ request }) => request.destination === 'document',
  new NetworkOnly()
);

// API calls: always network, never cache.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly()
);

// JS/CSS/worker: stale-while-revalidate.
registerRoute(
  ({ request }) => ['script', 'style', 'worker'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Always fetch the latest Firebase messaging and config scripts.
registerRoute(
  ({ url }) => url.pathname === '/firebase-messaging-sw.js' || url.pathname === '/firebase-config.js',
  new NetworkOnly()
);

// Images and fonts: cache-first.
registerRoute(
  ({ request }) => ['image', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'media',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Ensure version.json is always fetched fresh.
registerRoute(
  ({ url }) => url.pathname.endsWith('/version.json'),
  new NetworkOnly()
);

setCatchHandler(async ({ event }) => {
  if (event.request.destination === 'document') {
    return (await caches.match(OFFLINE_URL, { ignoreSearch: true })) || Response.error();
  }
  return Response.error();
});

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
