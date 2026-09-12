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

export interface StructuredKnowledgeResult {
  services: Array<{
    name: string;
    price: number;
    durationMinutes: number;
    description?: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
}

export class KnowledgeExtractorService {

  /**
   * Szybka heurystyczna ekstrakcja gotowych par pytań i odpowiedzi (np. z plików .txt, CSV, JSON).
   * Trwa < 5ms i eliminuje konieczność wywoływania powolnego LLM dla przygotowanych list FAQ.
   */
  parseStructuredFaq(text?: string): StructuredKnowledgeResult | null {
    if (!text || typeof text !== 'string') return null;
    let trimmed = text.trim();
    if (!trimmed) return null;

    if (trimmed.includes('\\n') && !trimmed.includes('\n')) {
      trimmed = trimmed.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
    }

    // 1. Sprawdź format JSON
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].question || parsed[0].q)) {
          return {
            services: [],
            faq: parsed.map(item => ({
              question: String(item.question || item.q || '').trim(),
              answer: String(item.answer || item.a || item.odpowiedz || '').trim()
            })).filter(x => x.question && x.answer)
          };
        }
        if (parsed.faq && Array.isArray(parsed.faq) && parsed.faq.length > 0) {
          return {
            services: Array.isArray(parsed.services) ? parsed.services : [],
            faq: parsed.faq.map((item: any) => ({
              question: String(item.question || item.q || '').trim(),
              answer: String(item.answer || item.a || item.odpowiedz || '').trim()
            })).filter((x: any) => x.question && x.answer)
          };
        }
      } catch (_) {}
    }

    // 2. Sprawdź linie z wzorcami Pytanie: / Odpowiedź:, Q: / A:, P: / O: itp.
    const lines = trimmed.split(/\r?\n/);
    const pairs: Array<{ question: string; answer: string }> = [];
    let curQ = '';
    let curA = '';
    let inAnswer = false;

    const qRegex = /^(?:(?:(?:\d+[\.\)]\s*)?(?:pytanie|question|pyt|q|p)(?:\s*\d+)?[\s:\.\-–]+)|\d+[\.\)]\s+)(.+)$/i;
    const aRegex = /^(?:(?:(?:odpowiedź|odpowiedz|answer|odp|a|o)(?:\s*\d+)?[\s:\.\-–]+))(.+)$/i;
    const numberedQRegex = /^\d+[\.\)]\s+([^?\n\r]+?\?)\s*$/i;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const qMatch = trimmedLine.match(qRegex);
      const aMatch = trimmedLine.match(aRegex);
      const numQMatch = !qMatch && !aMatch ? trimmedLine.match(numberedQRegex) : null;

      if (qMatch) {
        if (curQ && curA) {
          pairs.push({ question: curQ.trim(), answer: curA.trim() });
        }
        curQ = qMatch[1];
        curA = '';
        inAnswer = false;
      } else if (numQMatch) {
        if (curQ && curA) {
          pairs.push({ question: curQ.trim(), answer: curA.trim() });
        }
        curQ = numQMatch[1];
        curA = '';
        inAnswer = true;
      } else if (aMatch) {
        if (curQ) {
          curA = aMatch[1];
          inAnswer = true;
        }
      } else {
        if (inAnswer) {
          curA += (curA ? ' ' : '') + trimmedLine;
        } else if (curQ) {
          curQ += ' ' + trimmedLine;
        }
      }
    }

    if (curQ && curA) {
      pairs.push({ question: curQ.trim(), answer: curA.trim() });
    }

    // 3. Sprawdź format tabeli / CSV (średniki, tabulatory, pionowe kreski)
    if (pairs.length < 3) {
      const csvPairs: Array<{ question: string; answer: string }> = [];
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        let parts: string[] | null = null;
        if (trimmedLine.includes('\t')) parts = trimmedLine.split('\t');
        else if (trimmedLine.includes(';') && (trimmedLine.match(/;/g) || []).length === 1) parts = trimmedLine.split(';');
        else if (trimmedLine.includes('|') && (trimmedLine.match(/\|/g) || []).length === 1) parts = trimmedLine.split('|');

        if (parts && parts.length === 2) {
          const q = parts[0].replace(/^["']|["']$/g, '').trim();
          const a = parts[1].replace(/^["']|["']$/g, '').trim();
          if (q && a && q.length > 3 && a.length > 1 && !q.toLowerCase().includes('pytanie') && !a.toLowerCase().includes('odpowiedz')) {
            csvPairs.push({ question: q, answer: a });
          }
        }
      }
      if (csvPairs.length >= 3) {
        return { services: [], faq: csvPairs };
      }
    }

    if (pairs.length >= 3) {
      return { services: [], faq: pairs };
    }

    return null;
  }

  /**
   * Generuje ustrukturyzowaną wiedzę JSON na podstawie czystego tekstu lub dostarczonego pliku
   */
  async generateStructuredKnowledge(rawText?: string, fileData?: string, mimeType?: string): Promise<StructuredKnowledgeResult> {
    // 1. Jeśli przekazano gotowy ustrukturyzowany plik/tekst z pytaniami i odpowiedziami, przetwarzamy go natychmiast bez LLM
    if (rawText && !fileData) {
      const fastResult = this.parseStructuredFaq(rawText);
      if (fastResult && fastResult.faq.length >= 3) {
        console.log(`⚡ Szybka ekstrakcja ustrukturyzowanego FAQ (${fastResult.faq.length} pytań w 1ms)`);
        return fastResult;
      }
    }

    // 2. Jeśli tekst jest bardzo długi (> 8000 znaków), dzielimy go na równoległe chunki
    if (rawText && !fileData && rawText.length > 8000) {
      return this.processChunksInParallel(rawText);
    }

    // 3. Pojedyncze wywołanie Gemini (dla plików multimedialnych lub krótszych tekstów)
    return this.callGeminiSingle(rawText, fileData, mimeType);
  }

  private async callGeminiSingle(rawText?: string, fileData?: string, mimeType?: string): Promise<StructuredKnowledgeResult> {
    const systemInstruction = `
Jesteś analitykiem i asystentem ekstrakcji wiedzy dla wirtualnej pracownicy EVA (Easy Voice Assistant). Twój cel to przeczytanie podanego tekstu, przeanalizowanie wgranego dokumentu lub odsłuchanie pliku audio, i wyodrębnienie z niego jak największej ilości ustrukturyzowanych danych w formacie JSON.

Zwróć TYLKO i WYŁĄCZNIE czysty JSON.
Struktura JSON musi wyglądać dokładnie tak:
{
  "services": [
    {
      "name": "string (nazwa usługi, np. Konsultacja)",
      "price": number (tylko liczba, bez waluty),
      "durationMinutes": number (tylko liczba, czas trwania w minutach),
      "description": "string (opcjonalny, szczegółowy opis usługi)"
    }
  ],
  "faq": [
    {
      "question": "string (przewidywane pytanie klienta)",
      "answer": "string (odpowiedź w pierwszej osobie, z perspektywy EVA, profesjonalna i wyczerpująca)"
    }
  ]
}

WAŻNE ZASADY EKSTRAKCJI FAQ:
1. Nie pomiń ŻADNEJ istotnej informacji! Jeśli tekst zawiera adres, godziny otwarcia, zasady anulacji, regulamin, informacje o parkingu, metody płatności, informacje o udogodnieniach - DLA KAŻDEJ z tych informacji stwórz osobny wpis w tablicy "faq".
2. Jeśli tekst jest bardzo długi, tablica "faq" powinna zawierać szczegółowe pytania i odpowiedzi. Ekstrahuj każdy najdrobniejszy szczegół!
3. Odpowiedzi EVA powinny brzmieć naturalnie, jakby rozmawiała z klientem przez telefon.

Poniżej znajdują się materiały do przeanalizowania (tekst, plik obrazkowy, pdf lub plik audio):
${rawText ? `"""\n${rawText}\n"""` : ''}
`;

    const parts: any[] = [{ text: systemInstruction }];

    if (fileData && mimeType) {
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
        config: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text || '{}';
      const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanedText);
      return {
        services: Array.isArray(parsedData.services) ? parsedData.services : [],
        faq: Array.isArray(parsedData.faq) ? parsedData.faq : []
      };
    } catch (error: any) {
      console.error('Błąd ekstrakcji wiedzy:', error);
      throw new Error('Nie udało się wyekstrahować danych z tekstu. Upewnij się, że tekst ma sens.');
    }
  }

  private async processChunksInParallel(rawText: string): Promise<StructuredKnowledgeResult> {
    console.log(`🚀 Dzielenie dużego tekstu (${rawText.length} znaków) na równoległe fragmenty...`);
    const chunkSize = 7000;
    const chunks: string[] = [];
    let start = 0;

    while (start < rawText.length) {
      let end = start + chunkSize;
      if (end >= rawText.length) {
        chunks.push(rawText.slice(start));
        break;
      }
      const nextNewline = rawText.indexOf('\n\n', end - 500);
      if (nextNewline !== -1 && nextNewline < end + 500) {
        end = nextNewline;
      }
      chunks.push(rawText.slice(start, end));
      start = end;
    }

    const limitedChunks = chunks.slice(0, 5);
    console.log(`⏱️ Uruchamianie ${limitedChunks.length} równoległych zapytań do Gemini 3.5 Flash...`);

    const results = await Promise.all(
      limitedChunks.map(chunk => this.callGeminiSingle(chunk))
    );

    const mergedServices: any[] = [];
    const mergedFaq: any[] = [];
    const seenQuestions = new Set<string>();

    for (const res of results) {
      if (res.services) mergedServices.push(...res.services);
      if (res.faq) {
        for (const item of res.faq) {
          const normQ = item.question.toLowerCase().trim();
          if (!seenQuestions.has(normQ)) {
            seenQuestions.add(normQ);
            mergedFaq.push(item);
          }
        }
      }
    }

    console.log(`✅ Zakończono równoległą ekstrakcję: wyodrębniono ${mergedFaq.length} pytań FAQ.`);
    return {
      services: mergedServices,
      faq: mergedFaq
    };
  }
}

export const knowledgeService = new KnowledgeExtractorService();

