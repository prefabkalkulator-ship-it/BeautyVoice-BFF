import { runDailyCron } from './jobs/cron';
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

// Start background cron jobs
import { processOutboundQueue } from './jobs/OutboundProcessor';

setTimeout(runDailyCron, 5000); // 5 sekund po starcie serwera
setInterval(processOutboundQueue, 60000); // Co 1 minutę sprawdzamy kolejkę Outbound
setInterval(runDailyCron, 24 * 60 * 60 * 1000); // Codziennie
