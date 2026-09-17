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
  /**
   * Szybka heurystyczna ekstrakcja gotowych par pytań i odpowiedzi (np. z plików .txt, CSV, JSON, Markdown).
   * Obsługuje formaty numerowane (1. Pytanie?), Q&A (Pytanie: / Odpowiedź:), Markdown (**Pytanie:**),
   * wieloliniowe odpowiedzi oraz formaty tabelaryczne.
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

    // 2. Parsowanie linii z obsługą markdown, numeracji i wielolinijkowych odpowiedzi
    const lines = trimmed.split(/\r?\n/);
    const pairs: Array<{ question: string; answer: string }> = [];
    let curQ = '';
    let curA = '';

    // Wzorce regex
    const explicitQRegex = /^(?:[*#\-_>\s]*)(?:(?:pytanie|question|pyt|q)(?:\s*\d+)?[\s:\.\-–]+)(.+)$/i;
    const singlePQRegex = /^(?:[*#\-_>\s]*)(?:p(?:\s*\d+)?[:\.\-–]\s*)(.+)$/i;
    const numberedQRegex = /^(?:[*#\-_>\s]*)(\d+)[\.\)]\s*(?:(?:pytanie|question|pyt|q|p)(?:\s*\d+)?[\s:\.\-–]+)?(.+)$/i;
    
    const explicitARegex = /^(?:[*#\-_>\s]*)(?:(?:odpowiedź|odpowiedz|answer|odp|a)(?:\s*\d+)?[\s:\.\-–]+)(.+)$/i;
    const singleOARegex = /^(?:[*#\-_>\s]*)(?:o(?:\s*\d+)?[:\.\-–]\s*)(.+)$/i;

    const cleanMarkdown = (str: string): string => {
      return str.replace(/^[*_`#\s]+/, '').replace(/[*_`\s]+$/, '').trim();
    };

    const isLikelyNewQuestion = (line: string): boolean => {
      if (explicitQRegex.test(line) || singlePQRegex.test(line)) return true;
      if (numberedQRegex.test(line)) return true;
      if (line.endsWith('?') && line.length < 200) {
        if (!explicitARegex.test(line) && !singleOARegex.test(line)) {
          return true;
        }
      }
      return false;
    };

    const extractQuestionText = (line: string): string => {
      let m = line.match(explicitQRegex);
      if (m) return cleanMarkdown(m[1]);
      m = line.match(singlePQRegex);
      if (m) return cleanMarkdown(m[1]);
      m = line.match(numberedQRegex);
      if (m) return cleanMarkdown(m[2]);
      return cleanMarkdown(line);
    };

    const extractAnswerText = (line: string): string => {
      let m = line.match(explicitARegex);
      if (m) return cleanMarkdown(m[1]);
      m = line.match(singleOARegex);
      if (m) return cleanMarkdown(m[1]);
      return cleanMarkdown(line);
    };

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      if (!trimmedLine) continue;

      const isExpA = explicitARegex.test(trimmedLine) || singleOARegex.test(trimmedLine);
      const isNewQ = !isExpA && isLikelyNewQuestion(trimmedLine);

      if (isNewQ) {
        if (curQ && curA) {
          pairs.push({ question: curQ.trim(), answer: curA.trim() });
          curQ = '';
          curA = '';
        }
        curQ = extractQuestionText(trimmedLine);
      } else if (isExpA) {
        const aText = extractAnswerText(trimmedLine);
        if (curQ) {
          curA = curA ? (curA + ' ' + aText) : aText;
        }
      } else {
        // Zwykła linia tekstu (np. po pytaniu bez prefiksu "Odpowiedź:")
        if (curQ && !curA) {
          curA = cleanMarkdown(trimmedLine);
        } else if (curQ && curA) {
          curA += '\n' + cleanMarkdown(trimmedLine);
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
          const q = cleanMarkdown(parts[0].replace(/^["']|["']$/g, ''));
          const a = cleanMarkdown(parts[1].replace(/^["']|["']$/g, ''));
          if (q && a && q.length > 3 && a.length > 1 && !q.toLowerCase().includes('pytanie') && !a.toLowerCase().includes('odpowiedz')) {
            csvPairs.push({ question: q, answer: a });
          }
        }
      }
      if (csvPairs.length >= 3) {
        return { services: [], faq: csvPairs };
      }
    }

    // Sprawdzanie jakości / sanity check:
    const questionMarkCount = (trimmed.match(/\?/g) || []).length;
    if (pairs.length < 3) {
      return null;
    }
    // Jeśli tekst miał ewidentnie dziesiątki pytań, a heurystyka zgubiła ponad połowę, nie odcinajmy tekstu
    if (questionMarkCount >= 10 && pairs.length < questionMarkCount * 0.4) {
      console.warn(`⚠️ Szybka heurystyka znalazła ${pairs.length} par przy ${questionMarkCount} znakach '?'. Przekazuję do pełnego modelu Gemini.`);
      return null;
    }

    return { services: [], faq: pairs };
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

    // Przetwarzamy do 25 fragmentów (do ~175 000 znaków) bez ucinania
    const limitedChunks = chunks.slice(0, 25);
    console.log(`⏱️ Uruchamianie ${limitedChunks.length} równoległych zapytań do Gemini 3.5 Flash (z ${chunks.length} fragmentów)...`);

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

