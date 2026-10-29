/**
 * Parser wizytówek vCard (.vcf) oraz tekstu kontaktów dla aplikacji EVA.
 * Obsługuje formaty vCard 2.1, 3.0, 4.0 oraz inteligentną ekstrakcję z tekstu.
 */

export interface ParsedContact {
  id: string; // temporary client-side id
  contactName: string;
  phoneNumber: string;
  rawPhone: string;
  category: string;
  customNotes?: string;
  allowPrioritySlots: boolean;
  selected: boolean;
}

/**
 * Normalizuje polski i międzynarodowy numer telefonu do formatu E.164 (+48...)
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  // Usuń wszystkie znaki poza cyframi i wiodącym plusem
  let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, '');
  
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  
  if (!cleaned.startsWith('+')) {
    // Jeśli 9 cyfr, to polski numer komórkowy / stacjonarny
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length === 9) {
      cleaned = '+48' + digitsOnly;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('48')) {
      cleaned = '+' + digitsOnly;
    } else {
      cleaned = '+' + digitsOnly;
    }
  }
  
  return cleaned;
}

/**
 * Czyści kodowanie Quoted-Printable (częste w starszych vCard 2.1)
 */
function decodeQuotedPrintable(str: string): string {
  try {
    return str.replace(/=([A-F0-9]{2})/gi, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
  } catch {
    return str;
  }
}

/**
 * Parsuje treść pliku .vcf (vCard)
 */
export function parseVCardContent(vcfText: string): ParsedContact[] {
  if (!vcfText || typeof vcfText !== 'string') return [];

  const contacts: ParsedContact[] = [];
  // Podział na poszczególne wizytówki BEGIN:VCARD ... END:VCARD
  const vcardBlocks = vcfText.split(/BEGIN:VCARD/i).slice(1);

  let tempCounter = 0;

  for (const block of vcardBlocks) {
    const lines = block
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Obsługa łamania linii w vCard (spacja lub tabulator na początku kolejnej linii)
      .replace(/\n[ \t]/g, '')
      .split('\n');

    let fullName = '';
    let lastName = '';
    let firstName = '';
    const phoneNumbers: string[] = [];
    let organization = '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (/^END:VCARD/i.test(line)) break;

      // Wykrywanie nazwy sformatowanej FN
      if (/^FN/i.test(line)) {
        const parts = line.split(':');
        if (parts.length > 1) {
          let val = parts.slice(1).join(':').trim();
          if (/ENCODING=QUOTED-PRINTABLE/i.test(parts[0])) {
            val = decodeQuotedPrintable(val);
          }
          fullName = val;
        }
      }
      // Alternatywnie N:Nazwisko;Imię;...
      else if (/^N/i.test(line) && !fullName) {
        const parts = line.split(':');
        if (parts.length > 1) {
          let val = parts.slice(1).join(':').trim();
          if (/ENCODING=QUOTED-PRINTABLE/i.test(parts[0])) {
            val = decodeQuotedPrintable(val);
          }
          const nameParts = val.split(';');
          lastName = nameParts[0]?.trim() || '';
          firstName = nameParts[1]?.trim() || '';
        }
      }
      // Wykrywanie numeru telefonu TEL
      else if (/^TEL/i.test(line)) {
        const parts = line.split(':');
        if (parts.length > 1) {
          const num = parts.slice(1).join(':').trim();
          if (num) {
            phoneNumbers.push(num);
          }
        }
      }
      // Wykrywanie firmy ORG
      else if (/^ORG/i.test(line)) {
        const parts = line.split(':');
        if (parts.length > 1) {
          organization = parts.slice(1).join(':').replace(/;/g, ' ').trim();
        }
      }
    }

    // Ustalanie ostatecznej nazwy
    let finalName = fullName;
    if (!finalName && (firstName || lastName)) {
      finalName = `${firstName} ${lastName}`.trim();
    }
    if (!finalName && organization) {
      finalName = organization;
    }
    if (!finalName) {
      finalName = 'Kontakt z telefonu';
    }

    // Tworzenie wpisu dla każdego unikalnego numeru telefonu w danej wizytówce
    for (const rawPhone of phoneNumbers) {
      const normalized = normalizePhoneNumber(rawPhone);
      // Wymagaj minimum 9 cyfr
      const digitsCount = normalized.replace(/\D/g, '').length;
      if (digitsCount >= 8) {
        // Unikaj duplikatów numerów w ramach tego samego importu
        if (!contacts.some(c => c.phoneNumber === normalized)) {
          tempCounter++;
          contacts.push({
            id: `temp_${Date.now()}_${tempCounter}`,
            contactName: finalName,
            phoneNumber: normalized,
            rawPhone: rawPhone,
            category: 'VIP',
            customNotes: organization ? `Firma: ${organization}` : undefined,
            allowPrioritySlots: true,
            selected: true
          });
        }
      }
    }
  }

  return contacts;
}

/**
 * Inteligentnie wyciąga kontakty z dowolnego wklejonego tekstu (SMS, mail, notatka)
 */
export function parseSmartText(text: string): ParsedContact[] {
  if (!text) return [];
  const lines = text.split('\n');
  const contacts: ParsedContact[] = [];
  let tempCounter = 0;

  // Regex dla polskich i międzynarodowych numerów tel. (9-13 cyfr z opcjonalnymi spacjami i plusem)
  const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,3}\)?[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const matches = line.match(phoneRegex);
    if (matches && matches.length > 0) {
      for (const match of matches) {
        const normalized = normalizePhoneNumber(match);
        const digits = normalized.replace(/\D/g, '');
        if (digits.length >= 8) {
          // Wyciągnij nazwę usuwając numer i ewentualne dwukropki/myślniki
          let nameCandidate = line
            .replace(match, '')
            .replace(/[:\-–—,\(\)]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (!nameCandidate || nameCandidate.length < 2) {
            nameCandidate = `Kontakt ${normalized}`;
          }

          if (!contacts.some(c => c.phoneNumber === normalized)) {
            tempCounter++;
            contacts.push({
              id: `smart_${Date.now()}_${tempCounter}`,
              contactName: nameCandidate,
              phoneNumber: normalized,
              rawPhone: match,
              category: 'VIP',
              allowPrioritySlots: true,
              selected: true
            });
          }
        }
      }
    }
  }

  return contacts;
}
