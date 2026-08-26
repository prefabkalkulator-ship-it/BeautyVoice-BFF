import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize firebase admin if not already initialized
if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault(), // Uses GOOGLE_APPLICATION_CREDENTIALS
    projectId: 'beautyvoice-bff'
  });
}

export class PushService {
  static async sendNotification(tokens: string[], title: string, body: string, url?: string) {
    if (!tokens || tokens.length === 0) return;
    
    const message = {
      notification: { title, body },
      data: {
        click_action: url || 'https://beautyvoice-bff.web.app/dashboard'
      },
      tokens
    };

    try {
      const response = await getMessaging().sendEachForMulticast(message);
      console.log(`[PushService] Pomyślnie wysłano: ${response.successCount}, Błędy: ${response.failureCount}`);
      // Remove stale tokens
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`Błąd wysyłki dla tokenu: ${tokens[idx]} - ${resp.error?.message}`);
          }
        });
      }
    } catch (err) {
      console.error('[PushService] Błąd ogólny FCM:', err);
    }
  }
}
