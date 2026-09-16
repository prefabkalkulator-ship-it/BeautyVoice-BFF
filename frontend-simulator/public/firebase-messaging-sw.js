importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyD0LUormqfSGX5uTbkcgMPtLkxef9SfcmM",
  authDomain: "beautyvoice-bff.firebaseapp.com",
  projectId: "beautyvoice-bff",
  storageBucket: "beautyvoice-bff.firebasestorage.app",
  messagingSenderId: "739272851032",
  appId: "1:739272851032:web:27ba0cb19f2ecb9744142d"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Otrzymano powiadomienie w tle:', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'BeautyVoice AI';
  const body = payload.notification?.body || payload.data?.body || '';
  const clickUrl = payload.data?.url || payload.data?.click_action || '/dashboard';
  const phone = payload.data?.phone || payload.notification?.data?.phone || '';
  const tag = payload.data?.tag || payload.notification?.tag || ('bv-alert-' + (phone ? phone.replace(/[^0-9]/g, '') : 'general'));

  const notificationOptions = {
    body: body,
    icon: '/EVA_favicon_192.png',
    badge: '/EVA_favicon_192.png',
    tag: tag,
    renotify: true,
    data: {
      url: clickUrl,
      phone: phone
    },
    actions: phone ? [
      {
        action: 'call',
        title: '📞 Zadzwoń'
      }
    ] : []
  };

  return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const data = event.notification.data || {};
  if (event.action === 'call' && data.phone) {
    const rawPhone = data.phone.trim();
    clients.openWindow('tel:' + rawPhone);
  } else {
    const targetUrl = data.url || '/dashboard';
    clients.openWindow(targetUrl);
  }
});
