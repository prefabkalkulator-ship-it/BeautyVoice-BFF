"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const WebhookController_1 = require("./controllers/WebhookController");
const app = (0, express_1.default)();
exports.app = app;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Endpoint używany przez asystenta głosowego (np. Vapi.ai) lub nasz frontendowy symulator
app.post('/api/chat', (req, res) => WebhookController_1.webhookController.handleIncomingChat(req, res));
// Endpoint specyficzny dla Custom LLM z Vapi.ai (wymaga standardu OpenAI)
app.post('/api/vapi-llm', (req, res) => WebhookController_1.webhookController.handleVapiCustomLLM(req, res));
// Endpoint kontrolny health check (wymagany np. przez Google Cloud Run)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});
//# sourceMappingURL=app.js.map