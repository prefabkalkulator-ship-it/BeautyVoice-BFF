import { google, Auth, sheets_v4, calendar_v3 } from 'googleapis';
import { config } from '../config/env';

export class GoogleWorkspaceClient {
  private auth: Auth.GoogleAuth;
  private sheets: sheets_v4.Sheets;
  private calendar: calendar_v3.Calendar;

  constructor() {
    // Inicjalizacja klienta autoryzacji z wykorzystaniem zmiennej środowiskowej GOOGLE_APPLICATION_CREDENTIALS
    // Zasięgi (scopes) wymagane do edycji kalendarza i arkuszy
    this.auth = new google.auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar',
      ],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  /**
   * Zwraca instancję Google Sheets API
   */
  public getSheetsClient(): sheets_v4.Sheets {
    return this.sheets;
  }

  /**
   * Zwraca instancję Google Calendar API
   */
  public getCalendarClient(): calendar_v3.Calendar {
    return this.calendar;
  }

  /**
   * Testuje połączenie uwierzytelniając się i pobierając podstawowe informacje z arkusza
   */
  public async testConnection(): Promise<boolean> {
    try {
      if (!config.googleSheetId) {
        throw new Error('Brak konfiguracji ID Arkusza');
      }
      
      // Prosty test - odczytanie metadanych arkusza
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: config.googleSheetId,
      });
      
      console.log(`✅ Połączono z arkuszem: ${response.data.properties?.title}`);
      return true;
    } catch (error) {
      console.error('❌ Błąd połączenia z Google API:', (error as Error).message);
      return false;
    }
  }
}

export const googleClient = new GoogleWorkspaceClient();
