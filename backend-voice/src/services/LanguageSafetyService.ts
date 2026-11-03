import { GoogleGenAI } from '@google/genai';
import { createRequire } from 'module';
import { AI_MODELS } from '../config/aiModels';

const require = createRequire(import.meta.url);
const { mulaw } = require('alawmulaw');
const { WaveFile } = require('wavefile');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy-key' });

/**
 * Sprawdza, czy dany tenant posiada pakiet uprawniający do pełnych transkrypcji rozmów
 * (Pakiet Osobisty Ekspert lub Pakiet Premium B2B).
 */
export function isTenantEligibleForTranscripts(tenant: any): boolean {
  if (!tenant) return false;
  const planName = (tenant?.subscription?.planName || '').toLowerCase();
  const isPersonalProfile = tenant?.businessProfile === 'personal' || planName.includes('personal');

  const isPersonalExpert =
    planName === 'personal_expert' ||
    planName.includes('expert') ||
    ((planName === 'beta_pilot' || planName === 'pilot') && Boolean(tenant?.betaNotes?.includes('Osobisty Ekspert')));

  const isB2BPremium =
    !isPersonalProfile &&
    (planName === 'premium' || planName === 'beta_pilot' || planName === 'pilot' || Boolean(tenant?.betaNotes?.includes('Premium')));

  const isDemo = tenant?.name === 'DEMO' || tenant?.businessProfile === 'demo';
  if (isDemo) return false;

  return isPersonalExpert || isB2BPremium;
}

/**
 * Sprawdza, czy dla danego tenanta należy zapisać pełną transkrypcję rozmowy
 * (wymagany pakiet Ekspert / Premium B2B oraz włączona opcja saveFullTranscripts w personalSchedule - domyślnie true).
 */
export function shouldRecordTranscriptForTenant(tenant: any): boolean {
  if (!isTenantEligibleForTranscripts(tenant)) return false;
  const sched = (tenant?.personalSchedule && typeof tenant.personalSchedule === 'object') ? (tenant.personalSchedule as any) : {};
  return sched.saveFullTranscripts !== false;
}

/**
 * Sprawdza, czy dla danego tenanta włączone jest automatyczne maskowanie danych wrażliwych PII (domyślnie true).
 */
export function isPiiRedactionEnabledForTenant(tenant: any): boolean {
  const sched = (tenant?.personalSchedule && typeof tenant.personalSchedule === 'object') ? (tenant.personalSchedule as any) : {};
  return sched.piiRedactionEnabled !== false;
}

/**
 * Deterministyczny filtr RODO / PII maskujący numery PESEL, karty płatnicze, numery IBAN oraz kody PIN w transkrypcji.
 */
export function sanitizeTranscriptPII(
  text: string,
  piiRedactionEnabled: boolean = true,
  extraSecrets: string[] = []
): string {
  if (!text || typeof text !== 'string') return text;
  if (!piiRedactionEnabled) return text;

  let sanitized = text;

  // 1. Maskowanie 16-26 cyfrowych numerów kart płatniczych / rachunków bankowych IBAN
  sanitized = sanitized.replace(/\b(?:\d[ -]*?){15,26}\b/g, '[NUMER KARTY/KONTA UKRYTY]');

  // 2. Maskowanie 11-cyfrowych numerów PESEL (ciągłych lub rozdzielanych pojedynczymi spacjami)
  sanitized = sanitized.replace(/\b\d{11}\b/g, '[PESEL UKRYTY]');
  sanitized = sanitized.replace(/\b(?:PESEL|pesel)[:\s]*[\d\s-]{11,15}\b/gi, 'PESEL: [PESEL UKRYTY]');

  // 3. Maskowanie jawnie podanych kodów PIN w kontekście słowa PIN / hasło
  sanitized = sanitized.replace(/\b(kod\s+pin|pin|hasło)[:\s]+(\d{4,8})\b/gi, '$1: [PIN UKRYTY]');

  // 4. Maskowanie przekazanych tajnych kodów PIN właściciela / wiedzy poufnej
  for (const secret of extraSecrets) {
    if (secret && secret.trim().length >= 4) {
      const escaped = secret.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      sanitized = sanitized.replace(new RegExp(`\\b${escaped}\\b`, 'g'), '[PIN UKRYTY]');
    }
  }

  return sanitized;
}

/**
 * Generuje pełną, ustrukturyzowaną transkrypcję rozmowy (z podziałem na role i znaczniki czasu [MM:SS])
 * z bufora audio 8kHz mulaw w pamięci RAM.
 */
export async function generateCallTranscriptFromMulaw(
  mulawBuffer: Buffer,
  options: {
    botName?: string;
    piiRedactionEnabled?: boolean;
    extraSecrets?: string[];
    needFallbackSummary?: boolean;
    summaryOnly?: boolean;
  }
): Promise<{ transcript: string | null; fallbackSummary?: string | null; fallbackCallerName?: string | null }> {
  try {
    // Minimum 3 sekundy nagrania (8000 bajtów/s * 3s = 24000 bajtów)
    if (!mulawBuffer || mulawBuffer.length < 24000) {
      return { transcript: null, fallbackSummary: null, fallbackCallerName: null };
    }

    const pcmInt16 = mulaw.decode(mulawBuffer);
    const wav = new WaveFile();
    wav.fromScratch(1, 8000, '16', pcmInt16);
    const wavBytes = wav.toBuffer();
    const wavBase64 = Buffer.from(wavBytes).toString('base64');

    const botLabel = options.botName || 'EVA';
    const piiInstruction = options.piiRedactionEnabled !== false
      ? 'OCHRONA RODO / PII: Jeśli w rozmowie padają numery PESEL, numery kart płatniczych, numery kont bankowych lub tajne kody PIN, zamaskuj je odpowiednio jako [PESEL UKRYTY], [KARTA UKRYTA] lub [PIN UKRYTY]. Numery telefonów kontaktowych pozostaw widoczne cyframi.'
      : 'Zapisuj numery telefonów i kwoty za pomocą cyfr.';

    const prompt = options.summaryOnly
      ? `Jesteś precyzyjnym analitykiem rozmów telefonicznych B2B/CRM.
Odsłuchaj nagranie rozmowy pomiędzy asystentem głosowym (${botLabel}) a rozmówcą (Klient), który rozłączył się przed końcem rozmowy.
Przygotuj konkretne, merytoryczne podsumowanie po polsku dla właściciela firmy: o co dokładnie pytał klient, jakich informacji szukał, czy podał swoje imię lub prosił o kontakt.
Zastosuj odpowiedni prefiks na początku podsumowania: [💼 Oferta/Doradztwo], [📅 Rezerwacja], [📝 Wiadomość] lub [ℹ️ Ogólne].

Odpowiedz WYŁĄCZNIE poprawnym obiektem JSON:
{
  "summary": "Zwięzłe, konkretne polskie podsumowanie CRM z prefiksem intencji (2-3 zdania)",
  "callerName": "Imię (lub imię i nazwisko) rozmówcy w mianowniku, jeśli przedstawił się w rozmowie, w przeciwnym razie null"
}`
      : `Jesteś precyzyjnym systemem transkrypcji rozmów telefonicznych B2B/CRM.
Odsłuchaj całe nagranie rozmowy pomiędzy asystentem głosowym (${botLabel}) a rozmówcą (Klient) i przygotuj pełny, czytelny stenogram dialogu.

ZASADY FORMATOWANIA TRANSKRYPCJI:
1. Każda wypowiedź w nowej linii w dokładnym formacie:
   [MM:SS] 🤖 ${botLabel}: treść wypowiedzi asystenta
   [MM:SS] 👤 Klient: treść wypowiedzi rozmówcy
2. Zachowaj chronologię i przybliżony czas od początku połączenia (np. [00:02], [00:08], [00:19]).
3. Jeśli cała rozmowa lub jej część toczyła się w języku obcym, zapisz wypowiedź i w nawiasie podaj polskie tłumaczenie.
4. Pomijaj szumy tła, trzaski i niezrozumiałe chrząknięcia.
5. ${piiInstruction}
${options.needFallbackSummary ? '6. Ponieważ rozmówca rozłączył się przed końcem, wygeneruj również zwięzłe podsumowanie rozmowy w polu "summary" (po polsku, z odpowiednim prefiksem: [💼 Oferta/Doradztwo], [📅 Rezerwacja], [📝 Wiadomość] lub [ℹ️ Ogólne]) oraz pole "callerName" (imię klienta jeśli padło lub null).' : ''}

Odpowiedz WYŁĄCZNIE poprawnym obiektem JSON:
{
  "transcript": "Pełny tekst dialogu wiersz po wierszu rozdzielony znakami nowej linii \\n"${options.needFallbackSummary ? ',\n  "summary": "Zwięzłe polskie podsumowanie CRM z prefiksem intencji",\n  "callerName": "Imię rozmówcy w mianowniku jeśli padło lub null"' : ''}
}`;

    const response = await ai.models.generateContent({
      model: AI_MODELS.TEXT_FLASH,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'audio/wav',
                data: wavBase64
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const rawJson = response.text?.trim() || '{}';
    const parsed = JSON.parse(rawJson);

    let transcript: string | null = !options.summaryOnly && typeof parsed.transcript === 'string' && parsed.transcript.trim().length > 5
      ? parsed.transcript.trim()
      : null;

    if (transcript) {
      transcript = sanitizeTranscriptPII(
        transcript,
        options.piiRedactionEnabled !== false,
        options.extraSecrets || []
      );
    }

    const fallbackSummary = typeof parsed.summary === 'string' && parsed.summary.trim().length > 5
      ? parsed.summary.trim()
      : null;

    const fallbackCallerName = typeof parsed.callerName === 'string' && parsed.callerName.trim().length >= 2 && parsed.callerName.trim().toLowerCase() !== 'null'
      ? parsed.callerName.trim()
      : null;

    return { transcript, fallbackSummary, fallbackCallerName };
  } catch (err: any) {
    console.error('⚠️ [TranscriptEngine] Błąd generowania transkrypcji/podsumowania z bufora audio:', err.message);
    return { transcript: null, fallbackSummary: null, fallbackCallerName: null };
  }
}

/**
 * Sprawdza heurystycznie, czy tekst streszczenia / notatki zawiera cechy języka obcego
 * (cyrylica, słowa kluczowe w języku angielskim, rumuńskim, niemieckim itp. lub brak polskich cech językowych).
 */
export function isLikelyForeignText(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  // 1. Cyrylica (ukraiński, rosyjski, białoruski)
  if (/[а-яА-ЯёЁіІїЇєЄґҐ]/.test(trimmed)) {
    return true;
  }

  // 2. Znane słowa obce / obcojęzyczne markery (rumuński, angielski, niemiecki itp.)
  const foreignKeywordsPattern = /\b(solicită|modificarea|ofertei|anterioare|prin|eliminarea|plăcii|fundație|ventilației|domnul|contacta|clientul|starea|discuție|mulțumesc|bună|ziua|please|thank you|thanks|would like|call back|callback|regarding|foundation|ventilation|offer|angebots|kunde|bitte|danke|vielen dank|customer|caller|appointment|tomorrow|morning|evening|afternoon|quote|renovation|schedule|reschedule|cancel|want|need|hello|good morning|contact|urgent|question|inquire|inquiry|price|cost|modify|change|remove|delete)\b/i;
  if (foreignKeywordsPattern.test(trimmed)) {
    return true;
  }

  // 3. Sprawdzenie dłuższych wypowiedzi pozbawionych polskich cech językowych
  // Usuwamy znaczniki intencji w nawiasach kwadratowych typu [💼 Oferta/Doradztwo]
  const textWithoutTags = trimmed.replace(/\[[^\]]+\]/g, ' ').trim();
  const words = textWithoutTags.split(/\s+/).filter(w => w.length > 1);
  if (words.length >= 4) {
    const hasPolishChars = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(textWithoutTags);
    const hasPolishWords = /\b(i|w|z|do|na|nie|się|o|że|to|po|od|jak|dla|czy|co|ze|za|jest|ma|pan|pani|klient|klientka|prosi|kontakt|rozmowa|rozmówca|sprawa|termin|oferta|oferty|podsumowanie|nastrój|spokojny|chce|godz|godzinie|będzie|wizyta|oddzwonić|usługa|cena|cennik)\b/i.test(textWithoutTags);
    if (!hasPolishChars && !hasPolishWords) {
      return true;
    }
  }

  return false;
}

/**
 * Zapewnia, że notatka AI, streszczenie rozmowy lub treść wiadomości są bezwzględnie w 100% w języku polskim
 * (język interfejsu, CRM i powiadomień Push dla właściciela), nawet gdy rozmówca mówił w języku obcym.
 */
export async function ensurePolishSummary(text: string): Promise<string> {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (trimmed.length === 0) return text;

  if (!isLikelyForeignText(trimmed)) {
    return trimmed;
  }

  try {
    const response = await ai.models.generateContent({
      model: AI_MODELS.TEXT_FLASH,
      contents: `Jesteś tłumaczem biznesowym w polskim systemie CRM/BFF. Przetłumacz poniższą notatkę / streszczenie rozmowy telefonicznej na naturalny, profesjonalny język polski dla właściciela firmy. Zachowaj nienaruszone prefiksy w nawiasach kwadratowych (np. [💼 Oferta/Doradztwo], [📝 Wiadomość], [📅 Rezerwacja], [🚨 Reklamacja/Problem], [🎯 Kwalifikacja Leada], [ℹ️ Ogólne]) oraz numery telefonów cyframi. Zwróć wyłącznie przetłumaczony tekst bez komentarzy i bez cudzysłowów.\n\nTreść do przetłumaczenia:\n${trimmed}`
    });

    const translated = response.text?.trim();
    if (translated && translated.length > 0) {
      console.log(`🌐 [LanguageSafety] Bezpiecznik językowy: przetłumaczono notatkę na j. polski:\nOryginał: "${trimmed}"\nPo polsku: "${translated}"`);
      return translated;
    }
  } catch (err) {
    console.error('⚠️ [LanguageSafety] Błąd podczas automatycznego tłumaczenia notatki na j. polski:', err);
  }

  return trimmed;
}
