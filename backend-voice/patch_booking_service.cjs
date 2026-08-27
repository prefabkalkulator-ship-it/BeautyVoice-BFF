const fs = require('fs');
let code = fs.readFileSync('src/services/BookingService.ts', 'utf8');

// Update description for create_informational_campaign
code = code.replace(
  "description: 'Tagi odbiorc\\u015F\\u013A\\u20AC\\u2030w np. #vip (rozdzielone przecinkami) lub puste je\\u015F\\u203A\\u013A\\u201A\\u015Bli do wszystkich'",
  "description: 'Tagi odbiorców np. #vip, #uśpieni (rozdzielone przecinkami) lub puste jeśli do wszystkich'"
);

// Fallback replacement if encoding is completely mangled
code = code.replace(
  /description: 'Tagi odbiorc.*?w np. #vip \(rozdzielone przecinkami\).*?'/,
  "description: 'Tagi odbiorców np. #vip, #uśpieni (rozdzielone przecinkami) lub puste jeśli do wszystkich'"
);

// Add create_last_minute_offer to tool declarations
const lastMinuteTool = `
          {
            name: 'create_last_minute_offer',
            description: 'Uruchamia kampanię wyścigową (First-Come, First-Served) SMS dla luki w kalendarzu. Używaj zawsze, gdy właściciel prosi o wysłanie oferty "Last minute" i wskazuje termin okienka.',
            parameters: {
              type: 'OBJECT',
              properties: {
                campaign_name: { type: 'STRING', description: 'Nazwa robocza kampanii last minute' },
                audience_tags: { type: 'STRING', description: 'Tagi docelowe (np. #lojalny, #uśpieni) lub puste' },
                message_content: { type: 'STRING', description: 'Treść SMSa, musi zachęcać do odpowiedzi TAK (np. Dziś o 14:00 zwolnił się termin. Zarezerwuj odpisując TAK!)' },
                target_datetime: { type: 'STRING', description: 'Data i godzina zwalniającego się terminu w formacie ISO (np. 2026-08-27T14:00:00Z)' }
              },
              required: ['message_content', 'target_datetime']
            }
          },
`;

if (!code.includes('create_last_minute_offer')) {
  code = code.replace(
    /{[\s]*name:\s*'schedule_confirmation_flow'/,
    lastMinuteTool + "          {\n            name: 'schedule_confirmation_flow'"
  );
}

fs.writeFileSync('src/services/BookingService.ts', code, 'utf8');
