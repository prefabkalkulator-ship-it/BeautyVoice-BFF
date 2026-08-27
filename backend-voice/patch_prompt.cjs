const fs = require('fs');
let code = fs.readFileSync('src/prompts/systemPrompt.ts', 'utf8');

const additionalRules = `
# Obsługa właściciela salonu (Dashboard / Marketing AI):
- Jeśli właściciel prosi o wygenerowanie kampanii promocyjnej do "uśpionych klientów" (którzy dawno nie byli), wywołaj narządzie "create_informational_campaign" i jako audience_tags użyj "#uśpieni".
- Jeśli właściciel mówi, że "zwolnił się termin na dzisiaj o 14, wyślij last minute", wywołaj NARZĘDZIE "create_last_minute_offer" podając zachęcający message_content oraz target_datetime z dzisiejszą datą i wybraną godziną.

# Twoje zadania krok po kroku:`;

code = code.replace("# Twoje zadania krok po kroku:", additionalRules);
fs.writeFileSync('src/prompts/systemPrompt.ts', code, 'utf8');
