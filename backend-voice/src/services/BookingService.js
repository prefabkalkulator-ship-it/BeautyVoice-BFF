"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingService = exports.BookingService = void 0;
const GoogleWorkspaceClient_1 = require("./GoogleWorkspaceClient");
const env_1 = require("../config/env");
class BookingService {
    /**
     * Schematy narzędzi (Function Calling) dla Gemini
     */
    static getToolDefinitions() {
        return [
            {
                name: 'getServicesAndPrices',
                description: 'Pobiera aktualną listę usług salonu, ich ceny oraz czas trwania.',
                parameters: {
                    type: 'OBJECT',
                    properties: {},
                },
            },
            {
                name: 'checkAvailability',
                description: 'Sprawdza dostępne godziny na wizytę w danym dniu.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        date: {
                            type: 'STRING',
                            description: 'Data w formacie YYYY-MM-DD',
                        },
                        durationMinutes: {
                            type: 'INTEGER',
                            description: 'Czas trwania usługi w minutach',
                        },
                    },
                    required: ['date', 'durationMinutes'],
                },
            },
            {
                name: 'getFAQ',
                description: 'Pobiera listę najczęściej zadawanych pytań (FAQ) i odpowiedzi z bazy wiedzy salonu.',
                parameters: {
                    type: 'OBJECT',
                    properties: {},
                },
            },
            {
                name: 'bookAppointment',
                description: 'Rezerwuje wizytę dla klienta w systemie (CRM + Kalendarz).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        customerName: {
                            type: 'STRING',
                            description: 'Imię klienta',
                        },
                        customerPhone: {
                            type: 'STRING',
                            description: 'Numer telefonu klienta',
                        },
                        serviceName: {
                            type: 'STRING',
                            description: 'Nazwa wybranej usługi',
                        },
                        startTime: {
                            type: 'STRING',
                            description: 'Data i godzina rozpoczęcia wizyty w lokalnej strefie czasowej (np. 2024-05-20T14:30:00+02:00)',
                        },
                        durationMinutes: {
                            type: 'INTEGER',
                            description: 'Czas trwania usługi w minutach',
                        },
                    },
                    required: ['customerName', 'customerPhone', 'serviceName', 'startTime', 'durationMinutes'],
                },
            },
        ];
    }
    /**
     * 1. Pobiera usługi i ceny z zakładki 'Cennik'
     */
    async getServicesAndPrices() {
        try {
            const sheets = GoogleWorkspaceClient_1.googleClient.getSheetsClient();
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: env_1.config.googleSheetId,
                range: 'Cennik!A2:C', // Zakładamy: A=Nazwa, B=Cena, C=Czas
            });
            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                return [];
            }
            return rows.map((row) => ({
                name: row[0] || '',
                price: row[1] || '',
                durationMinutes: parseInt(row[2], 10) || 60, // domyślnie 60 min jeśli brak danych
            })).filter(item => item.name !== '');
        }
        catch (error) {
            console.error('Błąd pobierania cennika:', error);
            throw new Error('Nie udało się pobrać cennika z bazy danych.');
        }
    }
    /**
     * 2. Sprawdza wolne terminy w Kalendarzu Google
     */
    async checkAvailability(date, durationMinutes) {
        try {
            if (!env_1.config.googleCalendarId)
                throw new Error('Brak konfiguracji Kalendarza');
            const calendar = GoogleWorkspaceClient_1.googleClient.getCalendarClient();
            const timeMin = new Date(`${date}T08:00:00+02:00`);
            const timeMax = new Date(`${date}T18:00:00+02:00`); // Godziny pracy np. 8:00-18:00
            // Pobieramy wydarzenia w tym dniu
            const response = await calendar.events.list({
                calendarId: env_1.config.googleCalendarId,
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });
            const busySlots = response.data.items || [];
            const availableSlots = [];
            // Konwertujemy wydarzenia na obiekty start/end (w milisekundach)
            const bookedIntervals = busySlots.map(event => {
                return {
                    start: new Date(event.start?.dateTime || event.start?.date || 0).getTime(),
                    end: new Date(event.end?.dateTime || event.end?.date || 0).getTime()
                };
            });
            // Generujemy potencjalne sloty co 30 minut
            const slotStepMs = 30 * 60000;
            let currentSlot = timeMin.getTime();
            while (currentSlot + (durationMinutes * 60000) <= timeMax.getTime()) {
                const slotEnd = currentSlot + (durationMinutes * 60000);
                // Sprawdzamy czy ten slot koliduje z którymkolwiek zaplanowanym wydarzeniem
                const hasConflict = bookedIntervals.some(interval => {
                    return (currentSlot < interval.end && slotEnd > interval.start);
                });
                if (!hasConflict) {
                    const slotDate = new Date(currentSlot);
                    const hours = slotDate.getHours().toString().padStart(2, '0');
                    const minutes = slotDate.getMinutes().toString().padStart(2, '0');
                    availableSlots.push(`${hours}:${minutes}`);
                }
                currentSlot += slotStepMs; // Przechodzimy do następnego slota
            }
            return availableSlots;
        }
        catch (error) {
            console.error('Błąd sprawdzania kalendarza:', error);
            throw new Error('Nie udało się sprawdzić dostępności w kalendarzu.');
        }
    }
    /**
     * Pobiera sekcję FAQ z Arkusza
     */
    async getFAQ() {
        try {
            const sheets = GoogleWorkspaceClient_1.googleClient.getSheetsClient();
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: env_1.config.googleSheetId,
                range: 'FAQ!A2:B',
            });
            const rows = response.data.values;
            if (!rows || rows.length === 0)
                return [];
            return rows.map((row) => ({
                question: row[0] || '',
                answer: row[1] || ''
            })).filter(item => item.question !== '');
        }
        catch (error) {
            console.error('Błąd pobierania FAQ:', error);
            return []; // Zwracamy pustą listę żeby bot się nie zawiesił
        }
    }
    /**
     * 3. Rezerwuje wizytę: dodaje do Kalendarza i dopisuje do Arkusza (CRM)
     */
    async bookAppointment(customerName, customerPhone, serviceName, startTime, durationMinutes) {
        try {
            const sheets = GoogleWorkspaceClient_1.googleClient.getSheetsClient();
            const calendar = GoogleWorkspaceClient_1.googleClient.getCalendarClient();
            const startDate = new Date(startTime);
            const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
            // 1. Zapis w kalendarzu
            if (env_1.config.googleCalendarId) {
                await calendar.events.insert({
                    calendarId: env_1.config.googleCalendarId,
                    requestBody: {
                        summary: `Wizyta: ${serviceName} - ${customerName}`,
                        description: `Telefon: ${customerPhone}`,
                        start: { dateTime: startDate.toISOString() },
                        end: { dateTime: endDate.toISOString() },
                    },
                });
            }
            // 2. Zapis w CRM
            // Zgodnie z wytycznymi, wpis ma trafić do zakładki "CRM" na samą górę (wiersz 2)
            const dateStr = startDate.toISOString().split('T')[0];
            const timeStr = startDate.toISOString().split('T')[1].substring(0, 5);
            const spreadsheetId = env_1.config.googleSheetId;
            // Najpierw pobieramy metadane, żeby znać ID zakładki 'CRM'
            const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
            const crmSheet = sheetMeta.data.sheets?.find(s => s.properties?.title === 'CRM');
            if (!crmSheet)
                throw new Error('Nie znaleziono zakładki CRM w arkuszu');
            const sheetId = crmSheet.properties?.sheetId;
            // Krok 1: Wstaw pusty wiersz zaraz pod nagłówkami (index 1 to wiersz 2)
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            insertDimension: {
                                range: {
                                    sheetId: sheetId,
                                    dimension: 'ROWS',
                                    startIndex: 1,
                                    endIndex: 2
                                },
                                inheritFromBefore: false
                            }
                        }
                    ]
                }
            });
            // Krok 2: Wpisz dane do nowo utworzonego, pustego wiersza (A2:G2)
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'CRM!A2:G2',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [
                        [dateStr, timeStr, customerName, customerPhone, serviceName, 'Potwierdzona', 'Dodano przez AI']
                    ],
                },
            });
            return true;
        }
        catch (error) {
            console.error('Błąd rezerwacji:', error);
            throw new Error('Wystąpił problem podczas próby zapisania wizyty.');
        }
    }
}
exports.BookingService = BookingService;
exports.bookingService = new BookingService();
//# sourceMappingURL=BookingService.js.map