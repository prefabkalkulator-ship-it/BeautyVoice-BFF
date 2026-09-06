import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize firebase admin if not already initialized
if (getApps().length === 0) {
  // Remove conflicting env var on Cloud Run
if (process.env.K_SERVICE) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}
initializeApp({
    credential: applicationDefault(),
    projectId: 'beautyvoice-bff'
});
}

export class PushService {
  static async sendNotification(tokens: string[], title: string, body: string, url?: string, phone?: string) {
    if (!tokens || tokens.length === 0) return;
    
    const message = {
      data: {
        title,
        body,
        click_action: url || 'https://beautyvoice-bff.web.app/dashboard',
        phone: phone || ''
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
