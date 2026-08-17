"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const port = env_1.config.port;
app_1.app.listen(port, () => {
    console.log(`🚀 BeautyVoice BFF Server is running on port ${port}`);
    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️ OSTRZEŻENIE: Brak zmiennej GEMINI_API_KEY. Żądania do modelu nie powiodą się.');
    }
});
//# sourceMappingURL=index.js.map