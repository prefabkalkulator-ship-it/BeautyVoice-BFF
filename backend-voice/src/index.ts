import { runDailyCron } from './jobs/cron';
import { app } from './app';
import { config } from './config/env';
import { WebSocketServer } from 'ws';
import { CallOrchestrator } from './services/voice/CallOrchestrator';
import { copilotEngineService } from './services/voice/CopilotEngineService';

const port = config.port;

const server = app.listen(port, () => {
  console.log(`🚀 BeautyVoice BFF Server is running on port ${port}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ OSTRZEŻENIE: Brak zmiennej GEMINI_API_KEY. Żądania do modelu nie powiodą się.');
  }
});

// Serwery WebSocket (noServer: true) dla izolacji ścieżek
const twilioWss = new WebSocketServer({ noServer: true });
const copilotVoiceWss = new WebSocketServer({ noServer: true });
const copilotUiWss = new WebSocketServer({ noServer: true });

// 1. Główny kanał rozmów przychodzących i wychodzących bot-klient (Twilio)
twilioWss.on('connection', (ws) => {
  console.log('🔗 [WSS] Nowe połączenie WebSocket przychodzące (Twilio Ingress)');
  new CallOrchestrator(ws as any);
});

// 2. Dwukanałowy strumień audio 2-Leg Call Bridge dla Copilota na żywo
copilotVoiceWss.on('connection', (ws) => {
  console.log('🔗 [WSS] Nowe połączenie Copilot Voice Stream (Twilio 2-Leg)');
  let currentSessionId = '';

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.event === 'start') {
        currentSessionId = data.start.customParameters?.copilotSessionId || '';
        console.log(`🎙️ [CopilotVoice] Start forkowania audio dla sesji: ${currentSessionId}`);
      } else if (data.event === 'media' && currentSessionId) {
        const track = (data.media?.track === 'outbound' ? 'outbound' : 'inbound') as 'inbound' | 'outbound';
        copilotEngineService.handleMediaStream(currentSessionId, track, data.media.payload);
      } else if (data.event === 'stop') {
        console.log(`🎙️ [CopilotVoice] Zatrzymanie strumienia dla sesji: ${currentSessionId}`);
      }
    } catch (e) {}
  });
});

// 3. Kanał synchronizacji kokpitu w przeglądarce PWA (Glanceable UI)
copilotUiWss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId') || '';
  if (sessionId) {
    copilotEngineService.registerUiSocket(sessionId, ws as any);
  } else {
    ws.close(1008, 'Missing sessionId');
  }
});

// Router Upgrade HTTP -> WebSocket
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/api/twilio-voice') {
    twilioWss.handleUpgrade(request, socket, head, (ws) => {
      twilioWss.emit('connection', ws, request);
    });
  } else if (pathname === '/api/copilot-voice') {
    copilotVoiceWss.handleUpgrade(request, socket, head, (ws) => {
      copilotVoiceWss.emit('connection', ws, request);
    });
  } else if (pathname === '/api/copilot-ui') {
    copilotUiWss.handleUpgrade(request, socket, head, (ws) => {
      copilotUiWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Start background cron jobs
import { processOutboundQueue } from './jobs/OutboundProcessor';
import { instagramService } from './services/instagram/InstagramService';

setInterval(processOutboundQueue, 60000); // Co 1 minutę sprawdzamy kolejkę Outbound
setInterval(runDailyCron, 15 * 60 * 1000); // Co 15 minut sprawdzamy harmonogram briefingu i subskrypcji
setInterval(() => {
  if (process.env.INSTAGRAM_ACCESS_TOKEN) {
    instagramService.syncAndRespond({ dryRun: false, maxCommentReplies: 5, processDms: true }).catch((err) => {
      console.error('[Instagram Cron] Błąd synchronizacji:', err.message);
    });
  }
}, 5 * 60 * 1000); // Co 5 minut sprawdzamy nowe komentarze i wiadomości DM na Instagramie


