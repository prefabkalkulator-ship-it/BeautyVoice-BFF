const fs = require('fs');
let code = fs.readFileSync('C:\\Users\\Dymitr Mitrafanau\\.gemini\\antigravity\\brain\\d0a0ca76-785e-41ba-987f-3e8858666748\\implementation_plan.md', 'utf8');

const search = `## User Review Required
> [!IMPORTANT]
> - Zmiana struktury bazy danych (dodanie \`npsScore\` i \`surveySent\`) usunie na moment dane deweloperskie z powodu wymuszonej migracji w naszym tymczasowym środowisku (jeśli dodajemy kolumny non-nullable - tutaj są nullable, więc dane mogą ocaleć).
> - Czy link do Google Maps na potrzeby demonstracji ma brzmieć po prostu jako fikcyjny URL (np. \`https://g.page/r/nasza-firma\`), czy wolisz wpisać prawdziwy?

Proszę o **Zatwierdzenie (Proceed)** planu, abym mógł zająć się migracją bazy i kodowaniem całej logiki NPS!`;

const replace = `## Zaktualizowane założenia (po konsultacji)
1. **Brak utraty danych:** Migracja bazy danych (` + "`" + `npsScore` + "`" + `, ` + "`" + `surveySent` + "`" + `, ` + "`" + `reviewLink` + "`" + `) wykorzystuje wartości opcjonalne oraz domyślne, co oznacza w 100% bezpieczne wdrożenie bez naruszania istniejących klientów czy rezerwacji.
2. **Obsługa linku do Google Maps:** 
   - W modelu \`Tenant\` pojawi się pole \`reviewLink\`.
   - W zakładce **Ustawienia Firmy** (\`Settings.tsx\`) dodany zostanie odpowiedni interfejs.
   - Jeśli link jest uzupełniony, pozytywna ocena wygeneruje SMS z prośbą o recenzję. Jeśli brakuje linku, system bezpiecznie pominie link, wysyłając samo podziękowanie. EVA jest również świadoma tego pola i w odpowiednich warunkach może przypomnieć o jego uzupełnieniu.`;

code = code.replace(search, replace);

fs.writeFileSync('C:\\Users\\Dymitr Mitrafanau\\.gemini\\antigravity\\brain\\d0a0ca76-785e-41ba-987f-3e8858666748\\implementation_plan.md', code, 'utf8');
