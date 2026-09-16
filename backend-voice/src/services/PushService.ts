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
  static async sendNotification(
    tokens: string[], 
    title: string, 
    body: string, 
    url?: string, 
    phone?: string, 
    tenantId?: string,
    tag?: string
  ) {
    // Deduplikacja tokenów
    const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
    if (uniqueTokens.length === 0) return;
    
    const clickUrl = url || 'https://beautyvoice-bff.web.app/dashboard';
    const iconUrl = 'https://beautyvoice-bff.web.app/EVA_favicon_192.png';
    const notificationTag = tag || ('bv-alert-' + (phone ? phone.replace(/[^0-9]/g, '') : 'general'));

    // Pełny payload zgodny ze standardem WebPush:
    // 1. Obiekt 'notification' gwarantuje natychmiastowe wybudzenie urządzenia
    // 2. Obiekt 'data' i 'webpush.notification' ze stabilnym 'tag' zapobiegają duplikatom na Androidzie
    const message = {
      notification: {
        title: String(title || 'BeautyVoice'),
        body: String(body || '')
      },
      data: {
        title: String(title || 'BeautyVoice'),
        body: String(body || ''),
        click_action: String(clickUrl),
        phone: String(phone || ''),
        tag: notificationTag
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          title: String(title || 'BeautyVoice'),
          body: String(body || ''),
          icon: iconUrl,
          badge: iconUrl,
          tag: notificationTag,
          renotify: true,
          data: {
            url: String(clickUrl),
            phone: String(phone || ''),
            tag: notificationTag
          },
          actions: phone ? [
            {
              action: 'call',
              title: '📞 Zadzwoń'
            }
          ] : []
        },
        fcmOptions: {
          link: clickUrl
        }
      },
      tokens: uniqueTokens
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
