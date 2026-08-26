import { prisma } from '../prisma';
import { PushService } from '../services/PushService';

export async function runDailyCron() {
  console.log('[CRON] Uruchamiam codzienne sprawdzanie subskrypcji...');
  try {
    const now = new Date();
    
    // Szukamy subskrypcji paused
    const pausedSubs = await prisma.subscription.findMany({
      where: { status: 'paused', pausedUntil: { not: null } },
      include: { tenant: true }
    });

    for (const sub of pausedSubs) {
      if (!sub.pausedUntil) continue;
      
      const diffMs = sub.pausedUntil.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 3) {
        // Za 3 dni kończy się pauza
        if (sub.tenant.fcmTokens.length > 0) {
          await PushService.sendNotification(
            sub.tenant.fcmTokens,
            'Asystentka wraca za 3 dni! 🔔',
            'Twoje zawieszenie dobiega końca. Subskrypcja zostanie wznowiona, a asystentka zacznie odbierać połączenia.'
          );
        }
      } else if (diffDays <= 0) {
        // Pauza dobiegła końca - wznawiamy
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'active', pausedAt: null, pausedUntil: null }
        });
        if (sub.tenant.fcmTokens.length > 0) {
          await PushService.sendNotification(
            sub.tenant.fcmTokens,
            'Subskrypcja wznowiona! ✅',
            'Twoja wirtualna asystentka powróciła z urlopu i ponownie odbiera telefony.'
          );
        }
        console.log(`[CRON] Wznowiono subskrypcję dla ${sub.tenantId}`);
      }
    }
  } catch (err) {
    console.error('[CRON] Błąd:', err);
  }
}
