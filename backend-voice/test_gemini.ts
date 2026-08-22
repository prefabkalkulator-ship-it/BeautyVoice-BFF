import { GoogleGenAI } from '@google/genai'; const ai = new GoogleGenAI({ apiKey: 'mock' }); console.log(typeof ai.live.connect);
