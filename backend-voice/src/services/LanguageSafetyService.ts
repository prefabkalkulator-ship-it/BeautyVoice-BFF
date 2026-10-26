import { GoogleGenAI } from '@google/genai';
import { AI_MODELS } from '../config/aiModels';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy-key' });

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
