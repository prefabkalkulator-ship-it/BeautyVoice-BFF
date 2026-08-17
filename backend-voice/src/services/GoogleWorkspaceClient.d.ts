import { sheets_v4, calendar_v3 } from 'googleapis';
export declare class GoogleWorkspaceClient {
    private auth;
    private sheets;
    private calendar;
    constructor();
    /**
     * Zwraca instancję Google Sheets API
     */
    getSheetsClient(): sheets_v4.Sheets;
    /**
     * Zwraca instancję Google Calendar API
     */
    getCalendarClient(): calendar_v3.Calendar;
    /**
     * Testuje połączenie uwierzytelniając się i pobierając podstawowe informacje z arkusza
     */
    testConnection(): Promise<boolean>;
}
export declare const googleClient: GoogleWorkspaceClient;
//# sourceMappingURL=GoogleWorkspaceClient.d.ts.map