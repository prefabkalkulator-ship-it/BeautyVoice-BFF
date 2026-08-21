import { app } from './app';
import { config } from './config/env';
import { WebSocketServer } from 'ws';
import { CallOrchestrator } from './services/voice/CallOrchestrator';

const port = config.port;

const server = app.listen(port, () => {
  console.log(`🚀 BeautyVoice BFF Server is running on port ${port}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ OSTRZEŻENIE: Brak zmiennej GEMINI_API_KEY. Żądania do modelu nie powiodą się.');
  }
});

// Tworzymy serwer WebSocket podpięty pod instancję HTTP na wybranej ścieżce (Twilio Ingress)
const wss = new WebSocketServer({ server, path: '/api/twilio-voice' });

wss.on('connection', (ws) => {
  console.log('🔗 [WSS] Nowe połączenie WebSocket przychodzące (Twilio)');
  new CallOrchestrator(ws as any);
});
