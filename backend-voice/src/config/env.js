"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Ładujemy .env jeśli istnieje (w produkcji zmienne mogą być wstrzyknięte bezpośrednio)
dotenv_1.default.config();
exports.config = {
    port: process.env.PORT || 8080,
    googleSheetId: process.env.GOOGLE_SHEET_ID,
    googleCalendarId: process.env.GOOGLE_CALENDAR_ID,
    // Zmienna wymagana przez oficjalne SDK Google, jeśli używamy auth.getClient()
    googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json',
};
// Walidacja krytycznych zmiennych
if (!exports.config.googleSheetId) {
    console.warn('⚠️ Brak GOOGLE_SHEET_ID w zmiennych środowiskowych.');
}
if (!exports.config.googleCalendarId) {
    console.warn('⚠️ Brak GOOGLE_CALENDAR_ID w zmiennych środowiskowych.');
}
//# sourceMappingURL=env.js.map