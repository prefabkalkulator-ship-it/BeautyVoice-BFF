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

import { prisma } from '../prisma';

export class PushService {
  static async sendNotification(tokens: string[], title: string, body: string, url?: string, phone?: string, tenantId?: string) {
    if (!tokens || tokens.length === 0) return;
    
    const clickUrl = url || 'https://beautyvoice-bff.web.app/dashboard';

    const message = {
      notification: {
        title,
        body
      },
      data: {
        title,
        body,
        click_action: clickUrl,
        phone: phone || ''
      },
      webpush: {
        fcmOptions: {
          link: clickUrl
        }
      },
      tokens
    };

    try {
      const response = await getMessaging().sendEachForMulticast(message);
      console.log(`[PushService] Pomyślnie wysłano: ${response.successCount}, Błędy: ${response.failureCount}`);
      
      // Usuń nieaktywne / martwe tokeny z bazy danych tenanta
      if (response.failureCount > 0) {
        const deadTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.warn(`[PushService] Błąd wysyłki dla tokenu: ${tokens[idx]} - ${resp.error?.code || resp.error?.message}`);
            deadTokens.push(tokens[idx]);
          }
        });

        if (deadTokens.length > 0 && tenantId) {
          try {
            const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { fcmTokens: true } });
            if (tenant?.fcmTokens) {
              const cleanedTokens = tenant.fcmTokens.filter(t => !deadTokens.includes(t));
              await prisma.tenant.update({
                where: { id: tenantId },
                data: { fcmTokens: cleanedTokens }
              });
              console.log(`[PushService] Usunięto ${deadTokens.length} nieaktywnych tokenów z profilu tenanta ${tenantId}`);
            }
          } catch (cleanErr) {
            console.error('[PushService] Błąd podczas czyszczenia tokenów w DB:', cleanErr);
          }
        }
      }
    } catch (err) {
      console.error('[PushService] Błąd ogólny FCM:', err);
    }
  }
}
