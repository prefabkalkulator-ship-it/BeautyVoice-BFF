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
      const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isStandalone = typeof window !== 'undefined' && (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );

      // Identyfikator urządzenia dla unikania dublowania sesji
      let deviceId = '';
      if (typeof window !== 'undefined') {
        try {
          deviceId = localStorage.getItem('bv_device_id') || '';
          if (!deviceId) {
            deviceId = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
            localStorage.setItem('bv_device_id', deviceId);
          }
        } catch (e) {}
      }

      // Wysyłamy token do backendu wraz z flagami PWA, Mobile oraz deviceId
      fetch('/api/tenant/fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: currentToken, isStandalone, isMobile, deviceId })
      }).catch(console.error);
      return currentToken;
    } else {
      console.log('Użytkownik nie wyraził zgody na powiadomienia.');
    }
  } catch (err) {
    console.error('Błąd podczas pobierania tokena FCM:', err);
  }
};

export const subscribeToMessages = (callback: (payload: any) => void) => {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
