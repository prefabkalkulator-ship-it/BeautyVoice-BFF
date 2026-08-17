import dotenv from 'dotenv';
import path from 'path';

// Ładujemy .env jeśli istnieje (w produkcji zmienne mogą być wstrzyknięte bezpośrednio)
dotenv.config();

export const config = {
  port: process.env.PORT || 8080,
  googleSheetId: process.env.GOOGLE_SHEET_ID,
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID,
  // Zmienna wymagana przez oficjalne SDK Google, jeśli używamy auth.getClient()
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json',
};

// Walidacja krytycznych zmiennych
if (!config.googleSheetId) {
  console.warn('⚠️ Brak GOOGLE_SHEET_ID w zmiennych środowiskowych.');
}
if (!config.googleCalendarId) {
  console.warn('⚠️ Brak GOOGLE_CALENDAR_ID w zmiennych środowiskowych.');
}
