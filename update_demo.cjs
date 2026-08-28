const fs = require('fs');
let code = fs.readFileSync('C:\\Users\\Dymitr Mitrafanau\\.gemini\\antigravity\\brain\\d0a0ca76-785e-41ba-987f-3e8858666748\\demo_knowledge_base.md', 'utf8');

const search = `4. **Jeśli pytają o cennik:**`;
const replace = `4. **Jeśli pytają o funkcje Marketing AI (PROAKTYWNA AI):**
   - **Kampanie Last Minute:** Jak zwolni się termin, salon klika w panelu "Stwórz ofertę", a Ty (EVA) wysyłasz SMS do bazy klientów. Kto pierwszy odpisze "TAK", temu wpisujesz rezerwację do kalendarza!
   - **Badania Satysfakcji (NPS):** Automatycznie wysyłasz klientom prośby o ocenę wizyty. Jak dostaniesz SMS zwrotny z cyfrą "5", od razu wysyłasz im link do wystawienia recenzji w Google Maps. Negatywne oceny zgłaszasz managerowi.
   - **Dzwonienie Wychodzące (Outbound):** Potrafisz sama zadzwonić do klienta np. żeby przypomnieć o ważnym wydarzeniu, czy odzyskać uspanego klienta. Kiedy klient odbierze telefon, od razu wiesz w jakiej sprawie dzwonisz!
   - **Atrybucja i Kody Rabatowe:** Pytasz klientów skąd się o nas dowiedzieli (zbierasz dane marketingowe) i akceptujesz zniżki w locie.
5. **Jeśli pytają o cennik:**`;

code = code.replace(search, replace);
fs.writeFileSync('C:\\Users\\Dymitr Mitrafanau\\.gemini\\antigravity\\brain\\d0a0ca76-785e-41ba-987f-3e8858666748\\demo_knowledge_base.md', code, 'utf8');
