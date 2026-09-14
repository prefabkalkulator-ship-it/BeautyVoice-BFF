import { prisma } from '../prisma';
import { SMSService } from '../services/sms/SMSService';
import { VoiceOutboundService } from '../services/voice/VoiceOutboundService';

export async function processOutboundQueue() {
  try {
    const now = new Date();
    const hour = now.getUTCHours() + 2; // Zgrubna konwersja na PL time (TODO: użyć moment-timezone lub biblioteki)
    
    // QUIET HOURS: 20:00 - 09:00
    // hour = 22 -> quiet. hour = 8 -> quiet.
    if (hour >= 20 || hour < 9) {
      console.log('[OutboundProcessor] Cisza nocna (Quiet Hours). Wstrzymuję wysyłkę.');
      return;
    }

    // 1. Sprawdź przedawnione zadania voice (połączenie nieodebrane lub przerwane bez potwierdzenia po 3 min)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const staleVoiceTasks = await prisma.outboundQueue.findMany({
      where: {
        channel: 'voice',
        status: 'in_progress',
        processedAt: { lte: threeMinutesAgo }
      }
    });

    for (const staleTask of staleVoiceTasks) {
      const payload = (typeof staleTask.payload === 'object' && staleTask.payload !== null) ? staleTask.payload as any : {};
      const currentAttempts = payload.attempts || 1;
      const maxAttempts = payload.maxAttempts || 3;

      if (currentAttempts < maxAttempts) {
        const nextTime = new Date(Date.now() + 30 * 60 * 1000);
        console.log(`[OutboundProcessor] Rozmowa z ${staleTask.targetPhone} nie powiodła się (próba ${currentAttempts}/${maxAttempts}). Następna próba zaplanowana na: ${nextTime.toLocaleTimeString('pl-PL')}`);
        await prisma.outboundQueue.update({
          where: { id: staleTask.id },
          data: {
            status: 'pending',
            scheduledFor: nextTime,
            payload: {
              ...payload,
              attempts: currentAttempts + 1
            }
          }
        });
      } else {
        console.log(`[OutboundProcessor] Wyczerpano ${maxAttempts} prób kontaktu telefonicznego dla ${staleTask.targetPhone}. Oznaczam jako UNCONFIRMED.`);
        await prisma.outboundQueue.update({
          where: { id: staleTask.id },
          data: {
            status: 'failed',
            processedAt: new Date(),
            errorMessage: `Nie odebrano po ${maxAttempts} próbach kontaktu (co 30 min)`
          }
        });

        // Rejestracja zdarzenia w rejestrze połączeń (CallLog)
        await prisma.callLog.create({
          data: {
            tenantId: staleTask.tenantId,
            callerPhone: staleTask.targetPhone,
            callerName: payload.customerName || 'Klient',
            callerRole: 'CLIENT',
            durationSeconds: 0,
            status: 'UNCONFIRMED',
            summary: `[Niepotwierdzono (3 próby)] Wykonano 3 próby połączenia telefonicznego w odstępach co 30 minut. Klient nie odebrał telefonu.`,
            isProcessed: false
          }
        }).catch(err => console.error('[OutboundProcessor] Błąd tworzenia CallLog UNCONFIRMED:', err));

        // Aktualizacja statusu w kalendarzu
        if (payload.appointmentId && !String(payload.appointmentId).startsWith('adhoc_')) {
          await prisma.appointment.update({
            where: { id: payload.appointmentId },
            data: { status: 'unconfirmed' }
          }).catch(console.error);
        }
      }
    }

    // 2. Pobierz max 5 zadań z kolejki, by realizować rate limit (pacing)
    const tasks = await prisma.outboundQueue.findMany({
      where: { status: 'pending', scheduledFor: { lte: now } },
      take: 5,
      orderBy: { scheduledFor: 'asc' }
    });

    if (tasks.length === 0) return;
    console.log(`[OutboundProcessor] Przetwarzanie ${tasks.length} zadań wychodzących...`);

    for (const task of tasks) {
      // Oznacz jako przetwarzane
      await prisma.outboundQueue.update({
        where: { id: task.id },
        data: { status: 'processing' }
      });

      try {
        if (task.channel === 'sms') {
          const payload = task.payload as any;
          await SMSService.sendSMS(task.targetPhone, payload.text);
          
          await prisma.outboundQueue.update({
            where: { id: task.id },
            data: { status: 'done', processedAt: new Date() }
          });
        } else if (task.channel === 'voice') {
          const payload = (typeof task.payload === 'object' && task.payload !== null) ? task.payload as any : {};
          const currentAttempts = payload.attempts || 1;
          console.log(`[OutboundProcessor] Inicjowanie Voice Outbound Call do: ${task.targetPhone} (próba ${currentAttempts})`);
          const success = await VoiceOutboundService.initiateCall(task.id, task.targetPhone);
          
          if (success) {
            await prisma.outboundQueue.update({
              where: { id: task.id },
              data: { 
                status: 'in_progress',
                processedAt: new Date(),
                payload: {
                  ...payload,
                  attempts: currentAttempts
                }
              }
            });
          } else {
            const maxAttempts = payload.maxAttempts || 3;
            if (currentAttempts < maxAttempts) {
              const nextTime = new Date(Date.now() + 30 * 60 * 1000);
              console.warn(`[OutboundProcessor] Błąd inicjacji połączenia (próba ${currentAttempts}/${maxAttempts}). Ponowienie za 30 min.`);
              await prisma.outboundQueue.update({
                where: { id: task.id },
                data: { 
                  status: 'pending', 
                  scheduledFor: nextTime,
                  errorMessage: 'Błąd API Zadarma/Twilio przy inicjacji',
                  payload: { ...payload, attempts: currentAttempts + 1 }
                }
              });
            } else {
              await prisma.outboundQueue.update({
                where: { id: task.id },
                data: { status: 'failed', processedAt: new Date(), errorMessage: 'Błąd API Zadarma/Twilio po 3 próbach' }
              });

              await prisma.callLog.create({
                data: {
                  tenantId: task.tenantId,
                  callerPhone: task.targetPhone,
                  callerName: payload.customerName || 'Klient',
                  callerRole: 'CLIENT',
                  durationSeconds: 0,
                  status: 'UNCONFIRMED',
                  summary: `[Niepotwierdzono (3 próby)] Błąd inicjacji połączenia po 3 próbach.`,
                  isProcessed: false
                }
              }).catch(console.error);
            }
          }
        }
      } catch (err: any) {
        await prisma.outboundQueue.update({
          where: { id: task.id },
          data: { status: 'failed', processedAt: new Date(), errorMessage: err.message }
        });
      }

      // Rate limit / Pacing: 5 sekund między wiadomościami
      await new Promise(r => setTimeout(r, 5000));
    }

  } catch (err) {
    console.error('[OutboundProcessor] Błąd:', err);
  }
}
