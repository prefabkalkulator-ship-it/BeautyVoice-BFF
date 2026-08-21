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

      const reply = await geminiService.handleChat(message, history || [], tenant.id, tenant.name, tenant.businessProfile || 'solo');

      console.log('🤖 Odpowiedź asystenta:', reply);

      res.status(200).json({
        reply: reply,
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
      // Vapi wysyła call.phoneNumber lub call.customer.number
      const calledNumber = call?.phoneNumber || call?.customer?.number;
      
      let tenant;
      if (calledNumber) {
        tenant = await prisma.tenant.findFirst({
          where: { phoneNumber: calledNumber }
        });
      }

      // Fallback: jeśli nie znaleziono po numerze (lub dzwonimy z panelu testowego), bierzemy pierwszego z bazy
      if (!tenant) {
        tenant = await prisma.tenant.findFirst();
      }

      if (!tenant) {
        res.status(400).json({ error: 'Brak przypisanego Tenanta dla tego numeru.' });
        return;
      }

      // Wyciągamy ostatnią wiadomość i historię
      let lastMessage = '';
      let history = [];
      
      const nonSystemMessages = messages.filter(m => m.role !== 'system');
      
      if (nonSystemMessages.length === 0) {
        // Vapi przysłało tylko system prompt - chce żeby asystent zaczął rozmowę
        lastMessage = 'Przywitaj się z klientem krótko, zgodnie z instrukcjami z system prompt (Dzień dobry, dodzwoniłeś się...).';
      } else {
        lastMessage = nonSystemMessages[nonSystemMessages.length - 1]?.content || '';
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
      const reply = await geminiService.handleChat(lastMessage, history, tenant.id, tenant.name, tenant.businessProfile || 'solo', onToolCall, onChunk);

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
