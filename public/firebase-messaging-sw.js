/**
 * Firebase Cloud Messaging Service Worker
 *
 * Handles background notifications when the app is not in focus
 */

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in service worker
// Note: Replace with your actual Firebase config
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'BloodHub India';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/notification-icon.png',
    badge: '/notification-badge.png',
    data: payload.data,
    tag: payload.data?.type || 'default',
    requireInteraction: payload.data?.priority === 'urgent',
    vibrate: [200, 100, 200],
    actions: getNotificationActions(payload.data?.type),
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Get notification actions based on type
function getNotificationActions(type) {
  switch (type) {
    case 'emergency_request':
      return [
        { action: 'respond', title: 'Respond Now', icon: '/icons/respond.png' },
        { action: 'view', title: 'View Details', icon: '/icons/view.png' },
      ];
    case 'appointment_reminder':
      return [
        { action: 'confirm', title: 'Confirm', icon: '/icons/confirm.png' },
        { action: 'reschedule', title: 'Reschedule', icon: '/icons/reschedule.png' },
      ];
    case 'blood_request_nearby':
      return [
        { action: 'view', title: 'View Request', icon: '/icons/view.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' },
      ];
    default:
      return [
        { action: 'open', title: 'Open App', icon: '/icons/open.png' },
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
  let url = '/';

  if (action === 'respond' && data?.requestId) {
    url = `/blood-requests/${data.requestId}`;
  } else if (action === 'view' && data?.id) {
    url = getUrlForType(data.type, data.id);
  } else if (data?.url) {
    url = data.url;
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
