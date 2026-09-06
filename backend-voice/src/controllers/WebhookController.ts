import { Request, Response } from 'express';
import { geminiService } from '../services/GeminiService';
import { prisma } from '../prisma';

export class WebhookController {
  public async handleIncomingChat(req: Request, res: Response): Promise<void> {
    try {
      const { message, history } = req.body;

      if (!message) {
        res.status(400).json({ error: 'Wymagane jest pole message.' });
        return;
      }

      // W uproszczonym symulatorze używamy pierwszego Tenanta
      const tenant = await prisma.tenant.findFirst();
      if (!tenant) {
        res.status(400).json({ error: 'Brak zdefiniowanego Tenanta w bazie danych.' });
        return;
      }

      console.log('🗣️ Otrzymano wiadomość:', message);

      let contextHistory = "";
      const recentQueue = await prisma.outboundQueue.findMany({ where: { status: 'done' }, orderBy: { scheduledFor: 'desc' }, take: 2 });
      if (recentQueue.length > 0) {
          contextHistory = `[HISTORIA KONTAKTU] Klient niedawno otrzymał z systemu SMS o treści: "${(recentQueue[0].payload as any).text}"`;
      }
      
      const contextualMessage = `[SYSTEM INFO: ${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}]
${contextHistory}
User: ${message}`;
        const reply = await geminiService.handleChat(contextualMessage, history || [], tenant.id, tenant.name, tenant.businessProfile || 'solo', tenant.reviewLink1);

        console.log('🤖 Odpowiedź asystenta:', reply);
      
      let finalReply = reply;
      let actionCard = undefined;

      try {
        if (reply.includes('_isActionCard')) {
          const parsed = JSON.parse(reply);
          if (parsed._isActionCard) {
            actionCard = {
              toolName: parsed.toolName,
              args: parsed.args
            };
            finalReply = ''; // Pusty tekst, UI wyrenderuje kartę
          }
        }
      } catch(e) {}

      res.status(200).json({
        reply: finalReply,
        actionCard: actionCard
      });
    } catch (error) {
      console.error('Webhook Error:', error);
      res.status(500).json({ error: 'Wewnętrzny błąd serwera.' });
    }
  }

  /**
   * Endpoint kompatybilny z formatem OpenAI (dla Vapi.ai Custom LLM)
   */
  public async handleVapiCustomLLM(req: Request, res: Response): Promise<void> {
    try {
      const { messages, call } = req.body;
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: 'Oczekiwano tablicy messages.' });
        return;
      }

      // Wyciągamy numer Vapi (numer salonu) z payloadu, aby zidentyfikować Tenanta
      const tenantNumber = call?.phoneNumber;
      const callerNumber = call?.customer?.number;
      
      let tenant;
      if (tenantNumber) {
        tenant = await prisma.tenant.findFirst({
          where: { phoneNumber: tenantNumber },
          include: { subscription: true }
        });
      }

      // Fallback: jeśli nie znaleziono po numerze (lub dzwonimy z panelu testowego), bierzemy pierwszego z bazy
      if (!tenant) {
        tenant = await prisma.tenant.findFirst({
          include: { subscription: true }
        });
      }

      if (!tenant) {
        res.status(400).json({ error: 'Brak przypisanego Tenanta dla tego numeru.' });
        return;
      }
      
      if (tenant.isSuspended || (tenant.subscription && (tenant.subscription.status === 'paused' || tenant.subscription.status === 'canceled'))) {
        const isStream = req.body.stream !== false;
        const msg = "Przepraszamy, ale asystent głosowy dla tego numeru jest obecnie niedostępny z przyczyn technicznych.";
        
        if (isStream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.flushHeaders();
          
          res.write(`data: ${JSON.stringify({ id: 'chatcmpl-1', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'beautyvoice', choices: [{ index: 0, delta: { content: msg }, finish_reason: null }] })}\n\n`);
          res.write(`data: ${JSON.stringify({ id: 'chatcmpl-1', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'beautyvoice', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          res.json({ id: 'chatcmpl-1', object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: 'beautyvoice', choices: [{ index: 0, message: { role: 'assistant', content: msg }, finish_reason: 'stop' }] });
        }
        return;
      }

      let systemContext = '';
      if (callerNumber) {
        const knownCustomer = await prisma.customer.findFirst({ where: { phone: callerNumber, tenantId: tenant.id } });
        if (knownCustomer) {
           systemContext = `\n\n[SYSTEM INFO] To jest połączenie od TWOJEGO STAŁEGO KLIENTA. Został rozpoznany po numerze telefonu (Caller ID). Jego imię to: ${knownCustomer.name}, a numer to: ${knownCustomer.phone}.
1) Powitaj go serdecznie po imieniu w pierwszym zdaniu.
2) ZAKAZ pytania o imię i numer telefonu w trakcie całej rozmowy (masz już te dane). (ZIGNORUJ PUNKT 6 Z INSTRUKCJI)
3) ZAKAZ pytania skąd klient dowiedział się o salonie. (ZIGNORUJ PUNKT 0 Z INSTRUKCJI)`;
        }
      }

      // Wyciągamy ostatnią wiadomość i historię
      let lastMessage = '';
      let history = [];
      
      const nonSystemMessages = messages.filter(m => m.role !== 'system');
      
      if (nonSystemMessages.length === 0) {
        // Vapi przysłało tylko system prompt - chce żeby asystent zaczął rozmowę
        lastMessage = 'Przywitaj się z klientem krótko, zgodnie z instrukcjami z system prompt (Dzień dobry, dodzwoniłeś się...).' + systemContext;
      } else {
        lastMessage = (nonSystemMessages[nonSystemMessages.length - 1]?.content || '') + (nonSystemMessages.length === 1 ? systemContext : '');
        history = nonSystemMessages.slice(0, -1);
      }

      console.log(`🗣️ [Vapi Tenant: ${tenant.name}] Otrzymano wiadomość:`, lastMessage);

      const isStream = req.body.stream !== false;
      const baseChunk = {
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'beautyvoice-custom-llm',
      };

      if (isStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        
        // Zawsze wysyłamy inicjalny chunk z rolą, aby Vapi poprawnie rozpoznało początek strumienia
        const roleChunk = {
          ...baseChunk,
          choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }]
        };
        res.write(`data: ${JSON.stringify(roleChunk)}\n\n`);
      }

      let hasSentFiller = false;
      const fillers = ["Hmm, sekundka... ", "Mhm, niech no zobaczę... ", "Jasne, już sprawdzam... "];
      const randomFiller = fillers[Math.floor(Math.random() * fillers.length)];

      const onToolCall = () => {
        if (isStream && !hasSentFiller) {
          hasSentFiller = true;
          // Zgodnie ze standardem OpenAI, wysyłamy tekst w osobnym chunku
          const contentChunk = {
            ...baseChunk,
            choices: [{ index: 0, delta: { content: randomFiller }, finish_reason: null }]
          };
          res.write(`data: ${JSON.stringify(contentChunk)}\n\n`);
        }
      };

      const onChunk = (text: string) => {
        if (isStream) {
          // Sanitization for TTS: avoid exclamation marks
          const sanitizedText = text.replace(/!/g, '.');

          const contentChunk = {
            ...baseChunk,
            choices: [{ index: 0, delta: { content: sanitizedText }, finish_reason: null }]
          };
          res.write(`data: ${JSON.stringify(contentChunk)}\n\n`);
        }
      };

      // Przekazujemy do naszej usługi z kontekstem Tenanta (bez filler words generowanych przez LLM)
      const reply = await geminiService.handleChat(lastMessage, history, tenant.id, tenant.name, tenant.businessProfile || "solo", tenant.reviewLink1, onToolCall, onChunk, callerNumber);

      console.log(`🤖 [Vapi Tenant: ${tenant.name}] Odpowiedź asystenta:`, reply);

      if (isStream) {
        const stopChunk = {
          ...baseChunk,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
        };
        res.write(`data: ${JSON.stringify(stopChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.status(200).json({
          id: 'chatcmpl-' + Date.now(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'beautyvoice-custom-llm',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: reply,
              },
              finish_reason: 'stop',
            },
          ],
        });
      }
    } catch (error) {
      console.error('Vapi Webhook Error:', error);
      res.status(500).json({ error: 'Wewnętrzny błąd serwera.' });
    }
  }
}

export const webhookController = new WebhookController();
