self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // By default, just pass the request through to the network.
  // This satisfies the PWA installability requirement for PWABuilder.
});
