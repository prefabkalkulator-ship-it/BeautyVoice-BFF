"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GeminiService_1 = require("./src/services/GeminiService");
async function test() {
    console.log("Using API Key:", process.env.GEMINI_API_KEY ? "Set" : "Not Set");
    console.log("Sending request...");
    try {
        const reply = await GeminiService_1.geminiService.handleChat("Dzień dobry, chciałbym umówić się na masaż");
        console.log("Reply:", reply);
    }
    catch (e) {
        console.error("Fatal Error:", e);
    }
}
test();
//# sourceMappingURL=scratch_test.js.map