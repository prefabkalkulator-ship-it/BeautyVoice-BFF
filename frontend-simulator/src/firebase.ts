import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyD0LUormqfSGX5uTbkcgMPtLkxef9SfcmM",
  authDomain: "beautyvoice-bff.firebaseapp.com",
  projectId: "beautyvoice-bff",
  storageBucket: "beautyvoice-bff.firebasestorage.app",
  messagingSenderId: "739272851032",
  appId: "1:739272851032:web:27ba0cb19f2ecb9744142d"
};

const app = initializeApp(firebaseConfig);

// Initialize messaging only if supported
let messagingInstance: any = null;
try {
  messagingInstance = getMessaging(app);
} catch(e) {}

export const messaging = messagingInstance;

export const requestForToken = async () => {
  if (!messaging) return;
  try {
    const currentToken = await getToken(messaging, { vapidKey: 'BHGAMyLplV3orS4FcZVaNyj7xcMjl6fFcc5SAMRNeihzEgIC43HLsVJ4llUDnYG0bPq3rOFDWpEPRQLt4XPdkRU' });
    if (currentToken) {
      console.log('FCM Token generated');
      // Wysyłamy token do backendu
      fetch('/api/tenant/fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: currentToken })
      }).catch(console.error);
      return currentToken;
    } else {
      console.log('Użytkownik nie wyraził zgody na powiadomienia.');
    }
  } catch (err) {
    console.error('Błąd podczas pobierania tokena FCM:', err);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
