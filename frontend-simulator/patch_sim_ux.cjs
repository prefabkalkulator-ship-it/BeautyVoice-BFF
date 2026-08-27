const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

// 1. Zmiana początkowej wiadomości (Point 4)
const initialMessageStr = `{ id: '1', role: 'assistant', content: 'Dzień dobry! Z tej strony EVA, wirtualna asystentka. W czym mogę pomóc?' }`;
const newInitialMessageStr = `{ id: '1', role: 'assistant', content: 'Dzień dobry! Z tej strony EVA, wirtualna asystentka. W czym mogę pomóc?\n\nPrzykładowe komendy:\n• "Wyślij przypomnienie z 10% rabatu do klientów z tagiem #lojalny, kanał sms"\n• "Uruchom potwierdzanie jutrzejszych rezerwacji SMSem"' }`;
code = code.replace(initialMessageStr, newInitialMessageStr);

// 2. Przycisk "Wyczyść czat" (Point 3)
const headerSearch = `<p className="text-surface-500 mt-1">Zarządzaj akcjami wychodzącymi (Outbound) i kampaniami informacyjnymi.</p>
        </div>
      </div>`;
const headerReplace = `<p className="text-surface-500 mt-1">Zarządzaj akcjami wychodzącymi (Outbound) i kampaniami informacyjnymi.</p>
        </div>
        <button onClick={() => { setMessages([{ id: '1', role: 'assistant', content: 'Dzień dobry! Z tej strony EVA, wirtualna asystentka. W czym mogę pomóc?\n\nPrzykładowe komendy:\n• "Wyślij przypomnienie z 10% rabatu do klientów z tagiem #lojalny, kanał sms"\n• "Uruchom potwierdzanie jutrzejszych rezerwacji SMSem"' }]); localStorage.removeItem('marketing_chat_history'); }} className="text-surface-500 hover:text-surface-800 text-sm font-medium px-3 py-1.5 border border-surface-200 rounded-lg hover:bg-surface-100 transition-colors">
          Wyczyść czat
        </button>
      </div>`;
code = code.replace(headerSearch, headerReplace);

// 3. Tłumaczenie etykiet (Point 1)
const mappingCode = `
                        {Object.entries((msg as any).actionCard.args).map(([k, v]) => {
                           const labels: Record<string, string> = {
                             campaign_name: 'Nazwa kampanii',
                             message_content: 'Treść wiadomości',
                             audience_tags: 'Grupa docelowa (Tagi)',
                             channel: 'Kanał',
                             scheduled_time: 'Czas wysyłki',
                             target_scope: 'Zakres rezerwacji',
                             confirmation_method: 'Metoda potwierdzania'
                           };
                           const label = labels[k] || k;
                           return (
                             <div key={k} className="flex flex-col sm:flex-row sm:gap-4">
                               <span className="font-medium text-surface-900 min-w-[150px]">{label}:</span>
                               <span className="break-words">{String(v)}</span>
                             </div>
                           );
                        })}
`;
// Zastępujemy starą mapę argumntów
const mapRegex = /\{Object\.entries\(\(msg as any\)\.actionCard\.args\)\.map\(\(\[k, v\]\) => \([\s\S]*?\)\)\}/;
code = code.replace(mapRegex, mappingCode);

fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
