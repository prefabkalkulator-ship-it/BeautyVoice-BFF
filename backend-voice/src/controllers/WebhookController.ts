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

      const reply = await geminiService.handleChat(message, history || [], tenant.id, tenant.name);

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

      // Wycigamy ostatnią wiadomość użytkownika oraz wcześniejszą historię
      const history = messages
        .filter(m => m.role !== 'system')
        .slice(0, -1);
      
      const lastMessage = messages[messages.length - 1]?.content || '';

      console.log(`🗣️ [Vapi Tenant: ${tenant.name}] Otrzymano wiadomość:`, lastMessage);

      // Przekazujemy do naszej usługi z kontekstem Tenanta
      const reply = await geminiService.handleChat(lastMessage, history, tenant.id, tenant.name);

      console.log(`🤖 [Vapi Tenant: ${tenant.name}] Odpowiedź asystenta:`, reply);

      // Sprawdzamy czy Vapi oczekuje strumienia (domyślnie tak)
      const isStream = req.body.stream !== false;

      if (isStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const baseChunk = {
          id: 'chatcmpl-' + Date.now(),
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'beautyvoice-custom-llm',
        };

        const contentChunk = {
          ...baseChunk,
          choices: [{ index: 0, delta: { role: 'assistant', content: reply }, finish_reason: null }]
        };
        res.write(`data: ${JSON.stringify(contentChunk)}\n\n`);

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
