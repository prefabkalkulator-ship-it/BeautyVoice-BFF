import { googleClient } from '../services/GoogleWorkspaceClient';
import { config } from '../config/env';

async function initializeSheet() {
  console.log('Rozpoczynam inicjalizację arkusza CRM...');
  try {
    const isConnected = await googleClient.testConnection();
    if (!isConnected) {
      console.error('Brak połączenia. Upewnij się, że plik credentials.json jest w katalogu backend-voice oraz że konto serwisowe ma dostęp (uprawnienie Edytor) do arkusza o ID:', config.googleSheetId);
      process.exit(1);
    }

    const sheets = googleClient.getSheetsClient();
    
    // Ustawiamy nagłówki w pierwszym rzędzie
    const headers = [
      'Data',
      'Godzina',
      'Imię klienta',
      'Numer telefonu',
      'Usługa',
      'Status (Potwierdzona/Anulowana)',
      'Uwagi AI'
    ];

    const spreadsheetId = config.googleSheetId;

    // Pobieramy informacje o arkuszach, aby znaleźć nazwę pierwszej zakładki
    const sheetMeta = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });
    
    if (!sheetMeta.data.sheets || sheetMeta.data.sheets.length === 0) {
      throw new Error('Arkusz nie posiada żadnych zakładek.');
    }
    
    const firstSheetName = sheetMeta.data.sheets[0].properties?.title || 'Sheet1';

    // Zapisujemy nagłówki
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${firstSheetName}!A1:G1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers],
      },
    });

    console.log('✅ Arkusz CRM został sformatowany pomyślnie. Dodano kolumny (w tym Numer telefonu).');
    
    // Opcjonalnie formatowanie nagłówków na pogrubione za pomocą batchUpdate
    const sheetId = sheetMeta.data.sheets[0].properties?.sheetId;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 7
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
                }
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)'
            }
          }
        ]
      }
    });
    
    console.log('✅ Zastosowano style wizualne dla nagłówków.');
  } catch (error) {
    console.error('❌ Błąd podczas inicjalizacji arkusza:', error);
  }
}

initializeSheet();
