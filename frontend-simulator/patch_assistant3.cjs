const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

const search = `{msg.content}
                  {(msg as any).actionCard`;

const replace = `{msg.content}
                  {msg.id === '1' && (
                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-surface-100">
                        <button onClick={() => handleSendDirect("Mamy wolne miejsce na dzisiaj na 16:00, stwórz ofertę Last Minute!")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">🚀 Oferta Last Minute</button>
                        <button onClick={() => handleSendDirect("Wyślij ankiety NPS do klientów, którzy byli u nas wczoraj")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">⭐️ Badanie NPS (Wczoraj)</button>
                        <button onClick={() => handleSendDirect("Wyślij zniżkę na powrót do uśpionych klientów (brak wizyty od 90 dni)")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">♻️ Wybudź klientów</button>
                        <button onClick={() => handleSendDirect("Potwierdź jutrzejsze wizyty sms-em")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">🗓 Potwierdź wizyty</button>
                      </div>
                  )}
                  {(msg as any).actionCard`;

code = code.replace(search, replace);
fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
