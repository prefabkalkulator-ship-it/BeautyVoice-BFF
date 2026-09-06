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

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.data?.title || 'BeautyVoice';
  const phone = payload.data?.phone;
  
  const notificationOptions = {
    body: payload.data?.body,
    icon: '/EVA_favicon_192.png',
    data: {
      url: payload.data?.click_action || '/',
      phone: phone
    },
    actions: phone ? [{ action: 'call', title: 'Zadzwoń' }] : []
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'call' && event.notification.data.phone) {
    const phone = event.notification.data.phone.replace('+', '%2B');
    clients.openWindow('/dashboard?call=' + phone);
  } else {
    clients.openWindow(event.notification.data.url);
  }
});
