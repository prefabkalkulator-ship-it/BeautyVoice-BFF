import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ Brak klucza GEMINI_API_KEY w zmiennych środowiskowych! AI nie zadziała.');
  }
  return new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });
};
const ai = getAI();

export class KnowledgeExtractorService {
  
  /**
   * Generuje ustrukturyzowaną wiedzę JSON na podstawie czystego tekstu lub dostarczonego pliku
   */
  async generateStructuredKnowledge(rawText?: string, fileData?: string, mimeType?: string) {
    const systemInstruction = `
Jesteś analitykiem i asystentem ekstrakcji wiedzy dla wirtualnej pracownicy EVA (Easy Voice Assistant). Twój cel to przeczytanie podanego tekstu, przeanalizowanie wgranego dokumentu lub odsłuchanie pliku audio, i wyodrębnienie z niego jak największej ilości ustrukturyzowanych danych w formacie JSON.

Zwróć TYLKO i WYŁĄCZNIE czysty JSON. Żadnych znaczników markdown (jak \`\`\`json).
Struktura JSON musi wyglądać dokładnie tak:
{
  "services": [
    {
      "name": "string (nazwa usługi, np. Wynajem domku Premium)",
      "price": number (tylko liczba, bez waluty),
      "durationMinutes": number (tylko liczba, czas trwania w minutach, lub 1440 jeśli to wynajem na 1 dobę),
      "description": "string (opcjonalny, szczegółowy opis usługi)"
    }
  ],
  "faq": [
    {
      "question": "string (przewidywane pytanie klienta, np. 'Gdzie się znajdujecie?', 'Czy jest parking?', 'W jakich godzinach jesteście otwarci?')",
      "answer": "string (odpowiedź w pierwszej osobie, z perspektywy EVA, profesjonalna i wyczerpująca, np. 'Nasz obiekt znajduje się pod adresem...', 'Tak, posiadamy bezpłatny parking...')"
    }
  ]
}

WAŻNE ZASADY EKSTRAKCJI FAQ:
1. Nie pomiń ŻADNEJ istotnej informacji! Jeśli tekst zawiera adres, godziny otwarcia, zasady anulacji, regulamin, informacje o parkingu, metody płatności, informacje o udogodnieniach (np. WiFi, czy można z psem) - DLA KAŻDEJ z tych informacji stwórz osobny wpis w tablicy "faq".
2. Jeśli tekst jest bardzo długi, tablica "faq" powinna być odpowiednio długa i zawierać nawet kilkanaście lub kilkadziesiąt szczegółowych pytań i odpowiedzi. Ekstrahuj każdy najdrobniejszy szczegół, by EVA wiedziała o firmie wszystko!
3. Odpowiedzi EVA powinny brzmieć naturalnie, jakby rozmawiała z klientem przez telefon.

Poniżej znajdują się materiały do przeanalizowania (tekst, plik obrazkowy, pdf lub plik audio):
${rawText ? `"""\n${rawText}\n"""` : ''}
`;

    // Budujemy payload częściowy
    const parts: any[] = [{ text: systemInstruction }];

    // Jeżeli mamy plik przesyłany z frontendu jako base64, dodajemy go jako inlineData
    if (fileData && mimeType) {
      // FileReader z readAsDataURL zwraca "data:application/pdf;base64,JVBERi0xLjcKCj..."
      // Musimy wyodrębnić samą wartość base64
      const base64Content = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;
      
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Content,
        }
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: parts,
      });

      const responseText = response.text || '';
      
      // Oczyszczenie z markdown, jeśli AI mimo zakazu go zwróciło
      const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedData = JSON.parse(cleanedText);
      return parsedData;

    } catch (error: any) {
      console.error('Błąd ekstrakcji wiedzy:', error);
      throw new Error('Nie udało się wyekstrahować danych z tekstu. Upewnij się, że tekst ma sens.');
    }
  }
}

export const knowledgeService = new KnowledgeExtractorService();
