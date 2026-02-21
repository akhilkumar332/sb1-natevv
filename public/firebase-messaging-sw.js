/**
 * Firebase Cloud Messaging Service Worker
 *
 * Handles background notifications when the app is not in focus
 */

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Load Firebase config generated at build/dev time
try {
  importScripts('/firebase-config.js');
} catch (error) {
  console.warn('[firebase-messaging-sw.js] Failed to load firebase-config.js', error);
}

const firebaseConfig = self.firebaseConfig;
if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.warn('[firebase-messaging-sw.js] Missing Firebase config, messaging disabled.');
} else {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebaseConfig && firebaseConfig.apiKey ? firebase.messaging() : null;

const QUEUE_DB = 'bloodhub_fcm';
const QUEUE_STORE = 'pending_notifications';

function resolveDefaultRoute(payload) {
  const role = payload?.data?.userRole || payload?.data?.role;
  switch (role) {
    case 'ngo':
      return '/ngo/dashboard?panel=notifications';
    case 'bloodbank':
      return '/bloodbank/dashboard?panel=notifications';
    case 'donor':
    default:
      return '/donor/dashboard?panel=notifications';
  }
}

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function enqueueBackgroundMessage(payload) {
  if (!payload) return;
  const id = payload.messageId || (payload.data && payload.data.messageId) || `fcm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id,
    payload,
    receivedAt: Date.now(),
  };
  const db = await openQueueDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  try {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clientList.forEach((client) => {
      client.postMessage({ type: 'FCM_QUEUE_UPDATED' });
    });
  } catch (error) {
    console.warn('[firebase-messaging-sw.js] Failed to notify clients about queued message', error);
  }
}

// Handle background messages
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'BloodHub India';
  const priority = (payload.data?.priority || '').toString().toLowerCase();
  const type = payload.data?.type;
  const route =
    payload.data?.route ||
    payload.data?.url ||
    payload.data?.link ||
    payload.data?.click_action ||
    payload.fcmOptions?.link ||
    resolveDefaultRoute(payload);
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/notification-icon.svg',
    badge: '/notification-badge.svg',
    data: {
      ...(payload.data || {}),
      route,
    },
    tag: type || 'default',
    requireInteraction: priority === 'urgent' || priority === 'high' || type === 'emergency_request',
    vibrate: [200, 100, 200],
    actions: getNotificationActions(type),
  };

  enqueueBackgroundMessage(payload).catch((error) => {
    console.warn('[firebase-messaging-sw.js] Failed to enqueue background message', error);
  });

  return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Get notification actions based on type
function getNotificationActions(type) {
  switch (type) {
    case 'emergency_request':
      return [
        { action: 'respond', title: 'Respond Now', icon: '/notification-icon.svg' },
        { action: 'view', title: 'View Details', icon: '/notification-icon.svg' },
      ];
    case 'appointment_reminder':
      return [
        { action: 'confirm', title: 'Confirm', icon: '/notification-icon.svg' },
        { action: 'reschedule', title: 'Reschedule', icon: '/notification-icon.svg' },
      ];
    case 'blood_request_nearby':
      return [
        { action: 'view', title: 'View Request', icon: '/notification-icon.svg' },
        { action: 'dismiss', title: 'Dismiss', icon: '/notification-icon.svg' },
      ];
    default:
      return [
        { action: 'open', title: 'Open App', icon: '/notification-icon.svg' },
      ];
  }
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  // Determine URL based on action and data
  let url = data?.route || data?.url || '/donor/dashboard?panel=notifications';

  if (action === 'respond' && data?.requestId) {
    url = `/blood-requests/${data.requestId}`;
  } else if (action === 'view' && data?.id) {
    url = getUrlForType(data.type, data.id);
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not already open
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Get URL based on notification type
function getUrlForType(type, id) {
  switch (type) {
    case 'emergency_request':
    case 'blood_request_nearby':
      return `/blood-requests/${id}`;
    case 'appointment_reminder':
    case 'appointment_scheduled':
      return `/appointments/${id}`;
    case 'campaign_nearby':
    case 'campaign_starting':
      return `/campaigns/${id}`;
    case 'donation_reminder':
      return '/donor/dashboard';
    default:
      return '/';
  }
}
