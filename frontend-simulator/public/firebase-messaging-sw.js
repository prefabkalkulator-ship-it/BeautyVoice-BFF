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
  console.log('[firebase-messaging-sw.js] Otrzymano wiadomość w tle: ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
