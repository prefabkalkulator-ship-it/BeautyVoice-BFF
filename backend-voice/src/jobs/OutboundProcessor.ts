import { prisma } from '../prisma';
import { SMSService } from '../services/sms/SMSService';

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

    // Pobierz max 5 zadań z kolejki, by realizować rate limit (pacing)
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
          // Tutaj w przyszłości integracja API Zadarma / Twilio do wykonania automatycznego calla do bota.
          // Zastępczo oznaczamy jako zrobione.
          console.log(`[OutboundProcessor] Symulacja Voice Call do: ${task.targetPhone}`);
          await prisma.outboundQueue.update({
            where: { id: task.id },
            data: { status: 'done', processedAt: new Date(), errorMessage: 'Symulacja (brak wdrożonego API do inicjacji Voice)' }
          });
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
