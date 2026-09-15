self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Web Push Event Listener ──────────────────────────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('Push event but no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Push notification received:', data);

    const title = data.title || 'قريبلك';
    const options = {
      body: data.body || 'لديك إشعار جديد',
      icon: data.icon || '/icon-192x192.png',
      badge: data.badge || '/icon-192x192.png',
      dir: data.dir || 'rtl',
      lang: data.lang || 'ar',
      vibrate: data.vibrate || [200, 100, 200, 100, 200, 100, 200],
      tag: data.tag || 'qareeblak-notification',
      data: data.data || { url: '/' },
      requireInteraction: true
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error parsing push data', err);
    // Fallback if payload isn't JSON
    event.waitUntil(
      self.registration.showNotification('قريبلك', {
        body: event.data.text(),
        icon: '/icon-192x192.png',
        dir: 'rtl'
      })
    );
  }
});

// ── Notification Click Event Listener ─────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event.notification);
  event.notification.close();

  // Get the URL from the payload
  const urlToOpen = event.notification.data?.url || '/';

  // Check if the URL is already open in a window/tab
  const urlToFocus = new URL(urlToOpen, self.location.origin).href;
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      let matchingClient = null;
      
      // Try to find an existing window with the URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToFocus) {
          matchingClient = client;
          break;
        }
      }

      if (matchingClient) {
        // If found, focus it
        return matchingClient.focus();
      } else {
        // Otherwise, open a new window
        return self.clients.openWindow(urlToFocus);
      }
    })
  );
});

// By default, just pass the fetch request through to the network.
self.addEventListener('fetch', (event) => {
  // PWA minimal requirement
});
