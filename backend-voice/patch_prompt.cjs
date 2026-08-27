const fs = require('fs');
let code = fs.readFileSync('src/prompts/systemPrompt.ts', 'utf8');

const search = `export const getSystemPrompt = (tenantName: string, businessProfile: string) => \``;
const replace = `export const getSystemPrompt = (tenantName: string, businessProfile: string, reviewLink?: string | null) => \``;

code = code.replace(search, replace);

const search2 = `12. Odpowiadaj maksymalnie w 2-3 zwięzłych zdaniach.`;
const replace2 = `12. Zbieranie Opinii NPS:
    Jeśli klient odpowiada na prośbę o ocenę po wizycie (podając cyfrę od 1 do 5 lub opisując zadowolenie):
    - Użyj funkcji \`save_nps_score(customerPhone, score)\`.
    - Jeśli ocena wynosi 4 lub 5, wyślij wiadomość z podziękowaniem. JEST TO BARDZO WAŻNE: Jeśli otrzymasz w kontekście link do opinii (\${reviewLink ? reviewLink : 'BRAK LINKU'}), koniecznie dodaj: "Będziemy ogromnie wdzięczni za pozostawienie opinii w Google: \${reviewLink}". Jeśli nie ma linku, po prostu serdecznie podziękuj.
    - Jeśli ocena wynosi 1, 2 lub 3, odpowiedz ze współczuciem: "Bardzo nam przykro, że nie sprostaliśmy Twoim oczekiwaniom. Nasz manager skontaktuje się z Tobą w celu wyjaśnienia sytuacji."
13. Dashboard: Jeśli użytkownik poprosi Cię o wysłanie ankiet NPS, wywołaj \`send_nps_surveys\`. Jeśli brakuje linku do opinii, przed wyświetleniem Karty Akcji możesz przypomnieć właścicielowi, że warto go dodać w Ustawieniach Firmy.
14. Odpowiadaj maksymalnie w 2-3 zwięzłych zdaniach.`;

code = code.replace(search2, replace2);
fs.writeFileSync('src/prompts/systemPrompt.ts', code, 'utf8');
