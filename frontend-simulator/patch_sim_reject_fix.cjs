const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

const searchBtn = `<button className="px-4 py-2 text-surface-500 hover:text-surface-700 font-medium transition-colors">
                          Odrzuć
                        </button>`;
const replBtn = `<button 
                          onClick={() => {
                            const newMsgs = [...messages];
                            const idx = newMsgs.findIndex(m => m.id === msg.id);
                            if (idx !== -1) {
                              (newMsgs[idx] as any)._executed = true;
                              newMsgs.push({ id: Date.now().toString(), role: 'assistant', content: 'Akcja została odrzucona przez użytkownika.' });
                              setMessages(newMsgs);
                            }
                          }}
                          className="px-4 py-2 text-surface-500 hover:text-surface-700 font-medium transition-colors">
                          Odrzuć
                        </button>`;

code = code.replace(searchBtn, replBtn);
fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
