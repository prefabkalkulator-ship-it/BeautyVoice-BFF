"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookController = exports.WebhookController = void 0;
const express_1 = require("express");
const GeminiService_1 = require("../services/GeminiService");
class WebhookController {
    async handleIncomingChat(req, res) {
        try {
            // Przyjmujemy format JSON, np. od systemu Vapi.ai lub testowego frontendu
            const { message, history } = req.body;
            if (!message) {
                res.status(400).json({ error: 'Wymagane jest pole message.' });
                return;
            }
            console.log('🗣️ Otrzymano wiadomość:', message);
            // Przekazanie do usługi LLM
            const reply = await GeminiService_1.geminiService.handleChat(message, history || []);
            console.log('🤖 Odpowiedź asystenta:', reply);
            res.status(200).json({
                reply: reply,
            });
        }
        catch (error) {
            console.error('Webhook Error:', error);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera.' });
        }
    }
    /**
     * Endpoint kompatybilny z formatem OpenAI (dla Vapi.ai Custom LLM)
     */
    async handleVapiCustomLLM(req, res) {
        try {
            const { messages } = req.body;
            if (!messages || !Array.isArray(messages)) {
                res.status(400).json({ error: 'Oczekiwano tablicy messages.' });
                return;
            }
            // Wycigamy ostatnią wiadomość użytkownika oraz wcześniejszą historię
            const history = messages
                .filter(m => m.role !== 'system') // Pomijamy system prompt wysyłany przez Vapi, bo mamy swój w GeminiService
                .slice(0, -1);
            const lastMessage = messages[messages.length - 1]?.content || '';
            console.log('🗣️ [Vapi] Otrzymano wiadomość:', lastMessage);
            // Przekazujemy do naszej usługi
            const reply = await GeminiService_1.geminiService.handleChat(lastMessage, history);
            console.log('🤖 [Vapi] Odpowiedź asystenta:', reply);
            // Zwracamy odpowiedź w formacie jakiego oczekuje Vapi (zgodnym z OpenAI)
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
        catch (error) {
            console.error('Vapi Webhook Error:', error);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera.' });
        }
    }
}
exports.WebhookController = WebhookController;
exports.webhookController = new WebhookController();
//# sourceMappingURL=WebhookController.js.map