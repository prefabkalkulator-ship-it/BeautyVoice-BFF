/**
 * Scentralizowana konfiguracja modeli Gemini AI.
 * Wartości można nadpisywać za pomocą zmiennych środowiskowych w .env lub panelu Cloud Run.
 */
export const AI_MODELS = {
  // Model audio-to-audio czasu rzeczywistego (WebSockets BidiGenerateContent) dla połączeń telefonicznych
  VOICE_LIVE: process.env.GEMINI_VOICE_MODEL || 'models/gemini-3.8-live',

  // Model Flash do zadań tekstowych i multimodalnych (symulator czatu, ekstrakcja bazy wiedzy)
  TEXT_FLASH: process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash',

  // Model do audytu i moderacji tenanta (TOS, ocena ryzyka)
  MODERATION: process.env.GEMINI_MODERATION_MODEL || process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash',
};
