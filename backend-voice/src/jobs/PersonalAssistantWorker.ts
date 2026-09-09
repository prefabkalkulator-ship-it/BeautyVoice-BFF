import { prisma } from '../prisma';
import { PushService } from '../services/PushService';
import { EmailService } from '../services/email/EmailService';

export class PersonalAssistantWorker {
  /**
   * Przetwarza połączenie po jego zakończeniu (Post-call worker)
   * - Generuje podsumowanie jeśli brak
   * - Wysyła natychmiastowy Push FCM do właściciela z bezpośrednim linkiem call-back
   */
  public static async processPostCall(callLogId: string) {
    try {
      const callLog = await prisma.callLog.findUnique({
        where: { id: callLogId },
        include: { tenant: true }
      });

      if (!callLog || !callLog.tenant) {
        console.warn(`[PersonalAssistantWorker] Nie znaleziono CallLog o ID: ${callLogId}`);
        return;
      }

      // Właściciel dzwoniący do własnej asystentki nie potrzebuje alertu Push o własnym telefonie
      if (callLog.callerRole === 'OWNER') {
        await prisma.callLog.update({
          where: { id: callLogId },
          data: { isProcessed: true }
        });
        return;
      }

      const tenant = callLog.tenant;
      let summary = callLog.summary;

      // Jeśli dzwoniący nie skorzystał z save_call_message, stwórzmy eleganckie podsumowanie systemowe
      if (!summary) {
        const durationMin = Math.ceil(callLog.durationSeconds / 60);
        const callerDesc = callLog.callerName 
          ? `${callLog.callerName} (${callLog.callerPhone})` 
          : callLog.callerPhone;

        if (callLog.durationSeconds < 10) {
          summary = `Krótkie połączenie od ${callerDesc}. Rozłączono po ${callLog.durationSeconds} sek.`;
        } else {
          summary = `Połączenie od: ${callerDesc}. Czas trwania: ${durationMin} min. Asystentka obsłużyła zapytanie.`;
        }
      }

      // Wysyłka Push FCM jeśli nie była jeszcze wysłana
      if (!callLog.pushSent && tenant.fcmTokens && tenant.fcmTokens.length > 0) {
        const isUrgent = callLog.urgency === 'HIGH' || callLog.urgency === 'CRITICAL';
        const isVip = callLog.callerRole === 'VIP';
        
        let prefix = '📞';
        if (isUrgent) prefix = '🚨 [PILNE]';
        else if (isVip) prefix = '⭐ [VIP]';

        const callerLabel = callLog.callerName || callLog.callerPhone || 'Nieznany';
        const title = `${prefix} ${callerLabel}`;
        const body = summary;

        await PushService.sendNotification(
          tenant.fcmTokens,
          title,
          body,
          'https://beautyvoice-bff.web.app/dashboard',
          callLog.callerPhone !== 'nieznany' ? callLog.callerPhone : undefined
        );

        console.log(`📲 [PersonalAssistantWorker] Wysłano Push powiadomienie do właściciela (${tenant.name})`);
      }

      // Aktualizacja rekordu w bazie
      await prisma.callLog.update({
        where: { id: callLogId },
        data: {
          summary,
          pushSent: true,
          isProcessed: true
        }
      });
    } catch (err) {
      console.error('[PersonalAssistantWorker] Błąd w processPostCall:', err);
    }
  }

  /**
   * Generuje i wysyła poranny raport (Morning Executive Briefing) dla danego tenanta
   */
  public static async generateMorningBriefingForTenant(tenantId: string) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          annualEvents: true,
          vipContacts: true
        }
      });

      if (!tenant) {
        return { error: 'Nie znaleziono tenanta' };
      }

      const email = tenant.contactEmail || tenant.betaContactEmail;
      if (!email) {
        console.warn(`[Morning Briefing] Tenant ${tenant.name} nie ma skonfigurowanego adresu e-mail.`);
        return { error: 'Brak adresu e-mail w profilu tenanta' };
      }

      // 1. Data w strefie czasowej Warszawa
      const now = new Date();
      const warsawParts = new Intl.DateTimeFormat('pl-PL', {
        timeZone: 'Europe/Warsaw',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        weekday: 'long'
      }).formatToParts(now);

      const day = parseInt(warsawParts.find(p => p.type === 'day')?.value || '1', 10);
      const month = parseInt(warsawParts.find(p => p.type === 'month')?.value || '1', 10);
      const year = parseInt(warsawParts.find(p => p.type === 'year')?.value || '2026', 10);
      const weekday = warsawParts.find(p => p.type === 'weekday')?.value || '';
      const formattedDate = `${day < 10 ? '0' + day : day}.${month < 10 ? '0' + month : month}.${year}`;

      // 2. Pobranie dzisiejszych spotkań
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

      const appointments = await prisma.appointment.findMany({
        where: {
          tenantId: tenant.id,
          status: 'confirmed',
          startTime: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        include: {
          service: true
        },
        orderBy: {
          startTime: 'asc'
        }
      });

      // 3. Sprawdzenie ważnych rocznic (dzisiejszych oraz w ciągu najbliższych 3 dni)
      const todayEvents = tenant.annualEvents.filter(e => e.month === month && e.day === day);
      const upcomingEvents = tenant.annualEvents.filter(e => {
        if (e.month === month && e.day > day && e.day <= day + (e.reminderDaysAhead || 3)) {
          return true;
        }
        return false;
      });

      // 4. Podsumowanie ostatnich połączeń i wiadomości (ostatnie 24h)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCalls = await prisma.callLog.findMany({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: yesterday }
        },
        orderBy: { createdAt: 'desc' }
      });

      const messagesWaiting = recentCalls.filter(c => c.isMessageLeft || c.urgency === 'HIGH');

      // 5. Budowa szablonu HTML
      const ownerName = tenant.betaContactPerson || tenant.name;
      const professionTitle = tenant.profession ? ` | ${tenant.profession}` : '';

      const appointmentRows = appointments.length > 0 
        ? appointments.map(a => {
            const timeStr = new Intl.DateTimeFormat('pl-PL', {
              timeZone: 'Europe/Warsaw',
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date(a.startTime));
            return `
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;">
                <div style="font-weight: 700; color: #1e293b; font-size: 15px;">⏰ ${timeStr} — ${a.customerName}</div>
                <div style="color: #64748b; font-size: 13px; margin-top: 4px;">
                  📞 <a href="tel:${a.customerPhone}" style="color: #4f46e5; text-decoration: none;">${a.customerPhone}</a> 
                  ${a.service ? `• Cel: <strong>${a.service.name}</strong>` : ''}
                </div>
              </div>
            `;
          }).join('')
        : `<div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; color: #64748b;">
             ✨ Brak zaplanowanych spotkań na dziś. Idealny dzień na Deep Work i realizację priorytetowych projektów.
           </div>`;

      const eventBadges = (todayEvents.length > 0 || upcomingEvents.length > 0)
        ? `
          <div style="margin-top: 10px;">
            ${todayEvents.map(e => `
              <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;">
                <span style="background: #d97706; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Dziś!</span>
                <strong style="color: #92400e; margin-left: 8px; font-size: 14px;">${e.title}</strong> (${e.category})
              </div>
            `).join('')}
            ${upcomingEvents.map(e => `
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 14px; margin-bottom: 6px;">
                <span style="background: #2563eb; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">Za ${e.day - day} dni</span>
                <span style="color: #1e40af; margin-left: 8px; font-size: 13px;">${e.title} (${e.day}.${e.month})</span>
              </div>
            `).join('')}
          </div>
        `
        : `<div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; color: #94a3b8; font-size: 13px;">
             Brak ważnych rocznic i dat podatkowych w najbliższych dniach.
           </div>`;

      const callSummarySection = messagesWaiting.length > 0
        ? `
          <div style="margin-top: 10px;">
            ${messagesWaiting.map(m => `
              <div style="background: #ffffff; border-left: 4px solid ${m.urgency === 'HIGH' ? '#ef4444' : '#6366f1'}; border-radius: 0 8px 8px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 12px 16px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong style="color: #0f172a; font-size: 14px;">${m.callerRole === 'VIP' ? '⭐ [VIP] ' : ''}${m.callerName || m.callerPhone}</strong>
                  ${m.urgency === 'HIGH' ? '<span style="color: #ef4444; font-weight: 700; font-size: 11px;">🚨 PILNE</span>' : ''}
                </div>
                <div style="color: #334155; font-size: 13px; margin-top: 4px; line-height: 1.4;">${m.summary || 'Brak treści wiadomości'}</div>
                <div style="margin-top: 6px; font-size: 12px;">
                  <a href="tel:${m.callerPhone}" style="color: #4f46e5; font-weight: 600; text-decoration: none;">📞 Oddzwoń: ${m.callerPhone}</a>
                  ${m.actionItems ? `<span style="color: #64748b; margin-left: 8px;">• ${m.actionItems}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `
        : `<div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; color: #94a3b8; font-size: 13px;">
             Wszystkie sprawy z wczoraj są załatwione. Brak oczekujących wiadomości (odebrano łącznie: ${recentCalls.length} połączeń).
           </div>`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: #ffffff; padding: 24px; text-align: center; }
            .content { padding: 24px; }
            .section-title { font-size: 16px; font-weight: 700; color: #1e1b4b; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 20px; margin-bottom: 12px; display: flex; align-items: center; }
            .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 16px; }
            .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 22px; letter-spacing: -0.5px;">🌅 Poranny Raport Asystenta AI</h1>
              <div style="opacity: 0.85; font-size: 14px; margin-top: 6px;">${weekday.toUpperCase()}, ${formattedDate}${professionTitle}</div>
            </div>
            
            <div class="content">
              <p style="font-size: 15px; margin-top: 0;">
                Dzień dobry, <strong>${ownerName}</strong>! Oto zestawienie Twoich kluczowych spraw na dzisiejszy dzień przygotowane przez Twojego Asystenta AI.
              </p>

              <div class="section-title">📅 Harmonogram Dnia (${appointments.length})</div>
              ${appointmentRows}

              <div class="section-title">🎂 Ważne Rocznice i Daty</div>
              ${eventBadges}

              <div class="section-title">📩 Połączenia i Oczekujące Sprawy (${messagesWaiting.length})</div>
              ${callSummarySection}

              <div style="text-align: center; margin-top: 24px;">
                <a href="https://beautyvoice-bff.web.app/dashboard" class="btn">Otwórz Panel Zarządzania</a>
              </div>
            </div>

            <div class="footer">
              Wygenerowano automatycznie przez BeautyVoice AI Voice Assistant • Veritas Platform<br>
              Wszystkie prawa zastrzeżone © ${year}
            </div>
          </div>
        </body>
        </html>
      `;

      const plainText = `
        Poranny Raport Asystenta AI - ${formattedDate}
        Dzień dobry, ${ownerName}!
        
        Harmonogram na dziś (${appointments.length} spotkań):
        ${appointments.map(a => `- ${new Date(a.startTime).toLocaleTimeString('pl-PL')} ${a.customerName} (${a.customerPhone})`).join('\n') || 'Brak spotkań.'}
        
        Ważne daty:
        ${todayEvents.map(e => `[DZIŚ] ${e.title} (${e.category})`).join('\n') || 'Brak ważnych dat na dziś.'}
        
        Połączenia i wiadomości z ostatnich 24h:
        ${messagesWaiting.map(m => `- ${m.callerName || m.callerPhone}: ${m.summary}`).join('\n') || 'Brak oczekujących wiadomości.'}
        
        Panel: https://beautyvoice-bff.web.app/dashboard
      `;

      const subject = `🌅 Poranny Raport Asystenta AI: ${formattedDate} - ${ownerName}`;
      await EmailService.sendEmail(email, subject, html, plainText);

      // Zapisujemy czas wysłania raportu
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { lastBriefingSentAt: new Date() }
      });

      console.log(`✉️ [Morning Briefing] Pomyślnie wysłano poranny raport do: ${email} (${tenant.name})`);
      return {
        success: true,
        appointmentsCount: appointments.length,
        eventsCount: todayEvents.length + upcomingEvents.length,
        messagesCount: messagesWaiting.length
      };
    } catch (err: any) {
      console.error(`[Morning Briefing] Błąd podczas generowania raportu dla ${tenantId}:`, err);
      return { error: err.message || 'Błąd wysyłki raportu' };
    }
  }

  /**
   * Sprawdza wszystkich tenantów o profilu 'personal' i wysyła raport, jeśli wybije ich godzina poranna
   */
  public static async runDailyMorningBriefings() {
    console.log('⏰ [Morning Briefing Cron] Sprawdzam harmonogram porannych raportów...');
    try {
      const now = new Date();
      const warsawHour = parseInt(
        new Intl.DateTimeFormat('pl-PL', {
          timeZone: 'Europe/Warsaw',
          hour: 'numeric',
          hourCycle: 'h23'
        }).format(now),
        10
      );

      const personalTenants = await prisma.tenant.findMany({
        where: {
          businessProfile: 'personal',
          morningBriefingEnabled: true
        }
      });

      console.log(`[Morning Briefing Cron] Znaleziono ${personalTenants.length} aktywnych asystentów osobistych.`);

      for (const tenant of personalTenants) {
        // Sprawdzamy czy nadeszła godzina wysyłki dla danego właściciela (domyślnie 8:00)
        const targetHour = tenant.morningBriefingHour || 8;
        if (warsawHour < targetHour) {
          continue; // Jeszcze za wcześnie dla tego tenanta
        }

        // Sprawdzamy czy raport nie został już wysłany dzisiaj w strefie Warszawa
        if (tenant.lastBriefingSentAt) {
          const lastSentWarsaw = new Intl.DateTimeFormat('pl-PL', {
            timeZone: 'Europe/Warsaw',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
          }).format(new Date(tenant.lastBriefingSentAt));

          const currentWarsaw = new Intl.DateTimeFormat('pl-PL', {
            timeZone: 'Europe/Warsaw',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
          }).format(now);

          if (lastSentWarsaw === currentWarsaw) {
            // Raport na dzisiaj już został wysłany
            continue;
          }
        }

        console.log(`🚀 [Morning Briefing Cron] Rozpoczynam wysyłkę raportu dla tenanta: ${tenant.name} (${tenant.id})`);
        await this.generateMorningBriefingForTenant(tenant.id);
      }
    } catch (err) {
      console.error('[Morning Briefing Cron] Błąd globalny:', err);
    }
  }
}
