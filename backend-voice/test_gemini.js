const WebSocket = require('ws');
const apiKey = process.env.GEMINI_API_KEY;
const url = \wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=\\;
const ws = new WebSocket(url);

ws.on('open', () => {
  ws.send(JSON.stringify({
    setup: {
      model: 'models/gemini-3.1-flash-live-preview',
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } }
        }
      }
    }
  }));
});

ws.on('message', (data) => console.log('Message:', data.toString()));
ws.on('close', (code, reason) => console.log('Close:', code, reason.toString()));
