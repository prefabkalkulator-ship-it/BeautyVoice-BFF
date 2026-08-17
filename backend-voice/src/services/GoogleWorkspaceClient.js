"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleClient = exports.GoogleWorkspaceClient = void 0;
const googleapis_1 = require("googleapis");
const env_1 = require("../config/env");
class GoogleWorkspaceClient {
    auth;
    sheets;
    calendar;
    constructor() {
        // Inicjalizacja klienta autoryzacji z wykorzystaniem zmiennej środowiskowej GOOGLE_APPLICATION_CREDENTIALS
        // Zasięgi (scopes) wymagane do edycji kalendarza i arkuszy
        this.auth = new googleapis_1.google.auth.GoogleAuth({
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/calendar',
            ],
        });
        this.sheets = googleapis_1.google.sheets({ version: 'v4', auth: this.auth });
        this.calendar = googleapis_1.google.calendar({ version: 'v3', auth: this.auth });
    }
    /**
     * Zwraca instancję Google Sheets API
     */
    getSheetsClient() {
        return this.sheets;
    }
    /**
     * Zwraca instancję Google Calendar API
     */
    getCalendarClient() {
        return this.calendar;
    }
    /**
     * Testuje połączenie uwierzytelniając się i pobierając podstawowe informacje z arkusza
     */
    async testConnection() {
        try {
            if (!env_1.config.googleSheetId) {
                throw new Error('Brak konfiguracji ID Arkusza');
            }
            // Prosty test - odczytanie metadanych arkusza
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: env_1.config.googleSheetId,
            });
            console.log(`✅ Połączono z arkuszem: ${response.data.properties?.title}`);
            return true;
        }
        catch (error) {
            console.error('❌ Błąd połączenia z Google API:', error.message);
            return false;
        }
    }
}
exports.GoogleWorkspaceClient = GoogleWorkspaceClient;
exports.googleClient = new GoogleWorkspaceClient();
//# sourceMappingURL=GoogleWorkspaceClient.js.map