const fs = require('fs');
let code = fs.readFileSync('src/prompts/systemPrompt.ts', 'utf8');

const searchRules = '# Twoje zadania krok po kroku:';
const additionalPrompt = `# Twoje zadania krok po kroku:
0. **Lead Attribution**: Kiedy po raz pierwszy przyjmujesz rezerwację od nowego klienta i potwierdzasz ją wywołując bookAppointment, zaraz po tym grzecznie dopytaj: "A tak z ciekawości, skąd się Pan/Pani o nas dowiedział(a)?". Gdy klient odpowie (np. z Googla, z Facebooka), użyj narzędzia 'updateCustomerSource' by zaktualizować ten fakt w bazie.
0.5. **Kody rabatowe**: Jeśli klient sam poda kod rabatowy podczas rozmowy/czatu (lub zapytasz o kod jeśli jest na to przestrzeń), przekaż ten kod w opcjonalnym parametrze 'promoCode' narzędzia 'bookAppointment'.`;

code = code.replace(searchRules, additionalPrompt);

fs.writeFileSync('src/prompts/systemPrompt.ts', code, 'utf8');
