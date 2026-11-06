import { prisma } from '../prisma';
import { PushService } from '../services/PushService';

export async function runDailyCron() {
  console.log('[CRON] Uruchamiam sprawdzanie subskrypcji i okresów próbnych...');
  try {
    const now = new Date();
    
    // 1. Szukamy subskrypcji paused
    const pausedSubs = await prisma.subscription.findMany({
      where: { status: 'paused', pausedUntil: { not: null } },
      include: { tenant: true }
    });

    for (const sub of pausedSubs) {
      if (!sub.pausedUntil) continue;
      
      const diffMs = sub.pausedUntil.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 3) {
        if (sub.tenant.fcmTokens.length > 0) {
          await PushService.sendNotification(
            sub.tenant.fcmTokens,
            'Asystentka wraca za 3 dni! 🔔',
            'Twoje zawieszenie dobiega końca. Subskrypcja zostanie wznowiona, a asystentka zacznie odbierać połączenia.'
          );
        }
      } else if (diffDays <= 0) {
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

    // 2. Sprawdzamy wygasające okresy próbne / darmowe oraz pakiety Pre-Paid (bez auto-odnawiania Stripe i bez statusu VIP)
    const timedSubs = await prisma.subscription.findMany({
      where: {
        currentPeriodEnd: { not: null },
        isLifetimeFree: false,
        stripeSubscriptionId: null,
        status: { in: ['active', 'trialing'] }
      },
      include: { tenant: true }
    });

    for (const sub of timedSubs) {
      if (!sub.currentPeriodEnd || sub.tenant.name === 'DEMO') continue;

      const diffMs = sub.currentPeriodEnd.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 3 && diffDays > 0 && !sub.expiryWarningSent) {
        // Ostrzeżenie na 3 dni przed końcem darmowego okresu / Pre-Paid
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { expiryWarningSent: true }
        });

        if (sub.tenant.fcmTokens && sub.tenant.fcmTokens.length > 0) {
          await PushService.sendNotification(
            sub.tenant.fcmTokens,
            `Twój okres subskrypcji wygasa za ${diffDays} dni ⏳`,
            'Przedłuż swój pakiet w zakładce Subskrypcja (Apple Pay / BLIK / Karta), aby zachować ciągłość obsługi połączeń i dedykowany numer.'
          );
        }

        if (sub.tenant.phoneNumber && sub.tenant.phoneNumber.startsWith('+')) {
          try {
            const { SMSService } = await import('../services/sms/SMSService');
            await SMSService.sendSMS(
              sub.tenant.phoneNumber,
              `EVA AI: Twój darmowy/opłacony okres wygasa za ${diffDays} dni (${sub.currentPeriodEnd.toLocaleDateString('pl-PL')}). Przedłuż dostęp w panelu: https://beautyvoice-bff.web.app/dashboard/subscription`
            );
          } catch (smsErr) {
            console.warn('[CRON] Błąd wysyłki SMS przypominającego o wygaśnięciu:', smsErr);
          }
        }
      } else if (diffMs <= 0) {
        // Okres dobiegł końca -> zmieniamy status na expired (bonusMinutes zostają zachowane!)
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'expired' }
        });

        if (sub.tenant.fcmTokens && sub.tenant.fcmTokens.length > 0) {
          await PushService.sendNotification(
            sub.tenant.fcmTokens,
            'Okres subskrypcji dobiegł końca 🔒',
            'Odbieranie połączeń zostało tymczasowo wstrzymane. Opłać pakiet w zakładce Subskrypcja (BLIK / Apple Pay / Karta), aby natychmiast wznowić działanie asystenta.'
          );
        }
        console.log(`[CRON] Subskrypcja wygasła (expired) dla tenanta ${sub.tenant.name} (${sub.tenantId})`);
      }
    }

    // 3. Poranny raport wykonawczy (Morning Executive Briefing) dla Asystenta Osobistego
    const { PersonalAssistantWorker } = await import('./PersonalAssistantWorker');
    await PersonalAssistantWorker.runDailyMorningBriefings();
  } catch (err) {
    console.error('[CRON] Błąd:', err);
  }
}
