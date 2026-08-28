const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

const searchChips = `{messages.length === 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => handleSendDirect("Mamy wolne miejsce na dzisiaj na 16:00, stwórz ofertę Last Minute!")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all">🚀 Oferta Last Minute</button>
              <button onClick={() => handleSendDirect("Wyślij ankiety NPS do klientów, którzy byli u nas wczoraj")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all">⭐️ Badanie NPS (Wczoraj)</button>
              <button onClick={() => handleSendDirect("Wyślij zniżkę na powrót do uśpionych klientów (brak wizyty od 90 dni)")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all">♻️ Wybudź klientów</button>
              <button onClick={() => handleSendDirect("Potwierdź jutrzejsze wizyty sms-em")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all">🗓 Potwierdź wizyty</button>
            </div>
          )}`;

code = code.replace(searchChips, '');

fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
