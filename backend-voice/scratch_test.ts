import { geminiService } from './src/services/GeminiService';
import { config } from './src/config/env';

async function test() {
  console.log("Using API Key:", process.env.GEMINI_API_KEY ? "Set" : "Not Set");
  console.log("Sending request...");
  try {
    const reply = await geminiService.handleChat("Dzień dobry, chciałbym umówić się na masaż");
    console.log("Reply:", reply);
  } catch (e) {
    console.error("Fatal Error:", e);
  }
}

test();
