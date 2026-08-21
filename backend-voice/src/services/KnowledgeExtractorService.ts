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
Jesteś asystentką ekstrakcji wiedzy dla wirtualnej pracownicy EVA (Easy Voice Assistant). Twój cel to przeczytanie podanego tekstu, 
przeanalizowanie wgranego dokumentu lub odsłuchanie pliku audio (np. podyktowanej notatki głosowej), 
i wyodrębnienie z niego ustrukturyzowanych danych w formacie JSON.

Zwróć TYLKO i WYŁĄCZNIE czysty JSON. Żadnych znaczników markdown (jak \`\`\`json).
Struktura JSON musi wyglądać dokładnie tak:
{
  "services": [
    {
      "name": "string (nazwa usługi)",
      "price": number (tylko liczba, np. 50),
      "durationMinutes": number (tylko liczba, czas w minutach, np. 30),
      "description": "string (opcjonalny krótki opis lub null)"
    }
  ],
  "faq": [
    {
      "question": "string (pytanie potencjalnego klienta)",
      "answer": "string (odpowiedź w pierwszej osobie, z perspektywy EVA, np. 'Tak, mamy terminal.' lub 'Cześć! Oczywiście, u nas zapłacisz kartą.')"
    }
  ]
}

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
