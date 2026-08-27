import { GoogleGenAI } from '@google/genai';
import { bookingService, BookingService } from './BookingService';
import { getSystemPrompt } from '../prompts/systemPrompt';

// Inicjalizacja z dummy kluczem, żeby kontener mógł wstawać do podawania strony głównej bez API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy-key' });

export class GeminiService {
  /**
   * Funkcja pomocnicza do wysyłania wiadomości z mechanizmem retry dla błędów 503 (High Demand)
   */
  private async sendMessageStreamWithRetry(chat: any, params: any, maxRetries = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await chat.sendMessageStream(params);
      } catch (error: any) {
        if ((error?.status === 503 || error?.status === 429) && attempt < maxRetries) {
          const delay = error?.status === 429 ? 15000 : 2000;
          console.log(`[Gemini API] Błąd ${error?.status}. Próba ${attempt}/${maxRetries}. Ponawianie za ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Obsługuje pojedynczą turę konwersacji w webhooku
   * Przekazujemy historię konwersacji (z bazy danych / frontendu) i bieżącą wiadomość.
   */
  public async handleChat(message: string, history: any[] = [], tenantId: string, tenantName: string, businessProfile: string, onToolCall?: () => void, onChunk?: (text: string) => void): Promise<string> {
    try {
      // Transformacja historii na format akceptowany przez @google/genai
      const formattedHistory = history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      // Inicjalizacja sesji z odpowiednimi narzędziami, system promptem i historią
      const chat = ai.chats.create({
        model: 'gemini-3.5-flash',
        history: formattedHistory,
        config: {
          systemInstruction: getSystemPrompt(tenantName, businessProfile),
          temperature: 0.1, // Niska temperatura dla stabilnych i precyzyjnych rezerwacji
          tools: [{ functionDeclarations: BookingService.getToolDefinitions() as any }],
        }
      });

      let iteration = 0;
      let hasNotifiedToolCall = false;
      let messagePayload: any = { message };
      let fullText = '';

      while (iteration < 5) {
        iteration++;
        
        const stream = await this.sendMessageStreamWithRetry(chat, messagePayload);
        let hasFunctionCall = false;
        let functionCalls: any[] = [];
        let chunkCount = 0;

        for await (const chunk of stream) {
          chunkCount++;
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            hasFunctionCall = true;
            functionCalls = chunk.functionCalls;
          }
          if (chunk.text && !hasFunctionCall) {
            if (onChunk) onChunk(chunk.text);
            fullText += chunk.text;
          }
        }

        if (hasFunctionCall) {
          // Wywołujemy callback tylko raz przy pierwszym uzyciu narzędzia
          if (!hasNotifiedToolCall && onToolCall) {
            onToolCall();
            hasNotifiedToolCall = true;
          }

          const functionCall = functionCalls[0];
          const name = functionCall.name;
          const args = functionCall.args as any;

          let toolResult;

          try {
            
            if (name === 'create_informational_campaign' || name === 'schedule_confirmation_flow') {
              return JSON.stringify({
                _isActionCard: true,
                toolName: name,
                args: args
              });
            }
            if (name === 'getServicesAndPrices') {
              const data = await bookingService.getServicesAndPrices(tenantId);
              toolResult = data;
            } else if (name === 'getFAQ') {
              const data = await bookingService.getFAQ(tenantId);
              toolResult = data;
            } else if (name === 'checkAvailability') {
              const data = await bookingService.checkAvailability(tenantId, args.date, args.serviceName, args.durationMinutes, args.preferredStaffName);
              toolResult = data;
            } else if (name === 'bookAppointment') {
              const success = await bookingService.bookAppointment(
                tenantId,
                args.customerName,
                args.customerPhone,
                args.serviceName,
                args.startTime,
                args.durationMinutes,
                args.preferredStaffName
              );
              toolResult = { success };
            }
          } catch (err: any) {
            toolResult = { error: err.message };
          }

          // Zwracamy wynik narzędzia z powrotem do modelu, aby sformułował odpowiedź głosową (lub wywołał kolejną funkcję)
          messagePayload = {
            message: [{
              functionResponse: {
                name: name,
                response: { result: toolResult },
              }
            }]
          };
        } else {
          // Brak funkcji - model wygenerował pełny tekst.
          break;
        }
      }

      if (iteration >= 5 && fullText === '') {
        const fallback = 'Przepraszam, potrzebuję chwili na przetworzenie tych informacji. O czym rozmawialiśmy?';
        if (onChunk) onChunk(fallback);
        return fallback;
      }

      return fullText;
    } catch (error) {
      console.error('Gemini Service Error:', error);
      return 'Przepraszam, mam w tej chwili problemy z połączeniem z systemem. Proszę spróbować później.';
    }
  }
}

export const geminiService = new GeminiService();
