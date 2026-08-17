"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiService = exports.GeminiService = void 0;
const genai_1 = require("@google/genai");
const BookingService_1 = require("./BookingService");
const systemPrompt_1 = require("../prompts/systemPrompt");
// Upewnij się, że w zmiennych środowiskowych znajduje się GEMINI_API_KEY
const ai = new genai_1.GoogleGenAI({});
class GeminiService {
    /**
     * Funkcja pomocnicza do wysyłania wiadomości z mechanizmem retry dla błędów 503 (High Demand)
     */
    async sendMessageWithRetry(chat, params, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await chat.sendMessage(params);
            }
            catch (error) {
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
    async handleChat(message, history = []) {
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
                    systemInstruction: (0, systemPrompt_1.getSystemPrompt)(),
                    temperature: 0.1, // Niska temperatura dla stabilnych i precyzyjnych rezerwacji
                    tools: [{ functionDeclarations: BookingService_1.BookingService.getToolDefinitions() }],
                }
            });
            // Jeśli mamy historię, tutaj w pełnej wersji należałoby zrekonstruować obiekt chat
            // Do celów MVP, wysyłamy bieżącą wiadomość.
            let response = await this.sendMessageWithRetry(chat, { message });
            // Pętla do obsługi sekwencyjnych wywołań funkcji (max 5 iteracji dla bezpieczeństwa)
            let iteration = 0;
            while (response.functionCalls && response.functionCalls.length > 0 && iteration < 5) {
                iteration++;
                const functionCall = response.functionCalls[0];
                const name = functionCall.name;
                const args = functionCall.args;
                let toolResult;
                try {
                    if (name === 'getServicesAndPrices') {
                        const data = await BookingService_1.bookingService.getServicesAndPrices();
                        toolResult = data;
                    }
                    else if (name === 'getFAQ') {
                        const data = await BookingService_1.bookingService.getFAQ();
                        toolResult = data;
                    }
                    else if (name === 'checkAvailability') {
                        const data = await BookingService_1.bookingService.checkAvailability(args.date, args.durationMinutes);
                        toolResult = data;
                    }
                    else if (name === 'bookAppointment') {
                        const success = await BookingService_1.bookingService.bookAppointment(args.customerName, args.customerPhone, args.serviceName, args.startTime, args.durationMinutes);
                        toolResult = { success };
                    }
                }
                catch (err) {
                    toolResult = { error: err.message };
                }
                // Zwracamy wynik narzędzia z powrotem do modelu, aby sformułował odpowiedź głosową (lub wywołał kolejną funkcję)
                response = await this.sendMessageWithRetry(chat, {
                    message: [{
                            functionResponse: {
                                name: name,
                                response: { result: toolResult },
                            }
                        }]
                });
            }
            // Jeśli pętla przerwała się z powodu limitu, a odpowiedź nadal jest funkcją
            if (response.functionCalls && response.functionCalls.length > 0) {
                return 'Przepraszam, potrzebuję chwili na przetworzenie tych informacji. O czym rozmawialiśmy?';
            }
            return response.text || '';
        }
        catch (error) {
            console.error('Gemini Service Error:', error);
            return 'Przepraszam, mam w tej chwili problemy z połączeniem z systemem. Proszę spróbować później.';
        }
    }
}
exports.GeminiService = GeminiService;
exports.geminiService = new GeminiService();
//# sourceMappingURL=GeminiService.js.map