import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function Simulator() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sub, setSub] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/subscription')
      .then(res => res.json())
      .then(data => { setSub(data); setSubLoading(false); })
      .catch(() => setSubLoading(false));

    fetch('/api/services')
      .then(res => res.json())
      .then(data => setAvailableServices(data || []))
      .catch(() => {});

    fetch('/api/customers')
      .then(res => res.json())
      .then(data => {
        const tags = new Set<string>();
        data.forEach((c: any) => {
          if (c.tags && Array.isArray(c.tags)) {
            c.tags.forEach((t: string) => tags.add(t));
          }
        });
        setAvailableTags(Array.from(tags).sort());
      })
      .catch(() => {});
  }, []);


  
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('marketing_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch(e) {}
    }
    return [
      { id: '1', role: 'assistant', content: `Dzień dobry! Z tej strony EVA. Użyj poniższych przycisków, by uruchomić gotowe kampanie, lub po prostu napisz do mnie, co chcesz osiągnąć.` }
    ];
  });

  useEffect(() => {
    localStorage.setItem('marketing_chat_history', JSON.stringify(messages));
  }, [messages]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    setTimeout(scrollToBottom, 100);
  }, [messages]);
  
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 200);
  }, []);

  useEffect(() => {
    if (location.state?.initialPrompt && !subLoading && !isLoading) {
      const prompt = location.state.initialPrompt;
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => {
        handleSendDirect(prompt);
      }, 100);
    }
  }, [location.state, subLoading, isLoading, navigate]);

  const updateActionCardArg = (msgId: string, k: string, v: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === msgId && (m as any).actionCard) {
        return {
          ...m,
          actionCard: {
            ...(m as any).actionCard,
            args: {
              ...(m as any).actionCard.args,
              [k]: v
            }
          }
        };
      }
      return m;
    }));
  };

  const executeActionCard = async (msgId: string, actionCard: any) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, _loading: true } as any : m));
    try {
      const res = await fetch('/api/campaigns/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName: actionCard.toolName, args: actionCard.args })
      });
      if (res.ok) {
        let data: any = {};
        try { data = await res.json(); } catch(e) {}
        
        
        
        const hour = new Date().getHours();
        const quietHours = hour >= 20 || hour < 9;
        const quietSuffix = quietHours ? '\n\n(Uwaga: Obecnie trwa cisza nocna. Zlecenia oczekują w kolejce i zostaną wysłane po godz. 09:00)' : '';
        
        let contentStr = 'Uruchomiono pomyślnie!';
        if (actionCard.toolName === 'create_informational_campaign') {
           contentStr = `Uruchomiono pomyślnie! Kampania: ${actionCard.args.campaign_name || 'Informacyjna'}. Kanał: ${actionCard.args.channel === 'voice_call' ? 'Telefon' : 'SMS'}, Odbiorcy: ${actionCard.args.audience_tags || 'Wszyscy'}`;
        } else if (actionCard.toolName === 'create_last_minute_offer') {
           contentStr = `Uruchomiono pomyślnie! Oferta Last Minute na: ${actionCard.args.target_datetime}, Kanał: ${actionCard.args.channel === 'voice_call' ? 'Telefon' : 'SMS'}`;
        } else if (actionCard.toolName === 'send_nps_surveys') {
           contentStr = 'Uruchomiono badanie zadowolenia klienta.';
        }
        contentStr += quietSuffix;

        
        
        if (data && data.customersCount !== undefined) {
           contentStr += `\n\n(Zakwalifikowano ${data.customersCount} odbiorców spełniających kryteria tagów)`;
        }
        if (data && data.message) {
           contentStr += `\n\nSzczegóły: ${data.message}`;
        }

        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, _loading: false, _executed: true, content: contentStr } as any : m));
      } else {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, _loading: false, content: 'Błąd podczas uruchamiania.' } as any : m));
      }
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, _loading: false, content: 'Błąd połączenia.' } as any : m));
    }
  };

  const handleSendDirect = async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setInput("");
    setMessages(prev => {
      const updatedMessages = [...prev, userMsg];
      
      // Perform the fetch immediately inside so it captures the latest state
      setTimeout(() => {
        setIsLoading(true);
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: updatedMessages
              .filter(m => m.id !== '1')
              .map(m => ({ role: m.role, content: m.content }))
          })
        }).then(res => res.json()).then(data => {
            if (data.actionCard && data.actionCard.toolName === 'create_last_minute_offer' && data.actionCard.args && !('service_name' in data.actionCard.args)) {
              data.actionCard.args.service_name = '';
            }
            setMessages(prev2 => [...prev2, { id: Date.now().toString(), role: 'assistant', content: data.reply, actionCard: data.actionCard }]);
        }).catch(console.error).finally(() => setIsLoading(false));
      }, 0);

      return updatedMessages;
    });
    // We already handled fetch inside prev to avoid closure issues
    return;
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: updatedMessages
              .filter(m => m.id !== '1')
              .map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: data.reply, actionCard: data.actionCard }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== '1')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, history })
      });

      if (!response.ok) throw new Error('Błąd serwera');

      const data = await response.json();
      
      const assistantMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: data.reply
      };
      
      try {
        const parsed = JSON.parse(data.reply);
        if (parsed._isActionCard) {
           assistantMsg.content = "";
           (assistantMsg as any).actionCard = parsed;
        }
      } catch(e) {}

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: 'Błąd połączenia. Upewnij się, że backend działa.' 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Marketing AI</h2>
          <p className="text-surface-500 mt-1">Zarządzaj akcjami wychodzącymi (Outbound) i kampaniami informacyjnymi.</p>
        </div>
        <button onClick={() => { setMessages([{ id: '1', role: 'assistant', content: `Dzień dobry! Z tej strony EVA. Użyj poniższych przycisków, by uruchomić gotowe kampanie, lub po prostu napisz do mnie, co chcesz osiągnąć.` }]); localStorage.removeItem('marketing_chat_history'); }} className="text-surface-500 hover:text-surface-800 text-sm font-medium px-3 py-1.5 border border-surface-200 rounded-lg hover:bg-surface-100 transition-colors">
          Wyczyść czat
        </button>
      </div>

      <div className="flex-1 glass-card rounded-2xl flex flex-col overflow-hidden border border-surface-200/60 shadow-lg relative max-w-3xl mx-auto w-full mt-4">
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-24 space-y-6 bg-[#fafafa]/50 relative z-10">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="flex max-w-[95%] md:max-w-[85%]">
                
                {msg.role === 'user' ? (
                  <div className="p-3.5 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-sm leading-relaxed shadow-sm whitespace-pre-wrap">
                    <div className="flex items-center mb-1.5 text-primary-foreground/70">
                      <User size={14} />
                    </div>
                    {msg.content}
                  </div>
                ) : (
                  <div className="py-2 text-sm leading-relaxed text-surface-800 whitespace-pre-wrap">
                    <div className="flex items-center mb-1.5 text-gold-600">
                      <Bot size={14} />
                    </div>
                    
                  {msg.content}
                  {msg.id === '1' && (
                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-surface-100">
                        <button onClick={() => handleSendDirect("Mamy wolną rezerwację na dzisiaj na 16:00, stwórz ofertę Last Minute!")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">🚀 Oferta Last Minute</button>
                        <button onClick={() => handleSendDirect("Uruchom badanie zadowolenia klienta dla ostatnich wizyt")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">⭐️ Badanie zadowolenia klienta</button>
                        <button onClick={() => handleSendDirect("Wyślij zniżkę na powrót do uśpionych klientów (brak wizyty od 90 dni)")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">♻️ Wybudź klientów</button>
                        <button onClick={() => handleSendDirect("Potwierdź jutrzejsze rezerwacje sms-em")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">🗓 Potwierdź rezerwacje</button>
                      </div>
                  )}
                  {(msg as any).actionCard && !(msg as any)._executed && (
                    <div className="mt-4 p-5 bg-white border border-gold-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold-600">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        </div>
                        <h4 className="font-serif text-lg text-surface-900">Karta Akcji: {(msg as any).actionCard.toolName === 'create_informational_campaign' ? (((msg as any).actionCard.args?.audience_tags || '').includes('uśpieni') ? 'Wybudzanie Klientów' : 'Nowa Kampania') : ((msg as any).actionCard.toolName === 'create_last_minute_offer' ? 'Oferta Last Minute' : ((msg as any).actionCard.toolName === 'send_nps_surveys' ? 'Badanie zadowolenia klienta' : 'Weryfikacja Rezerwacji'))}</h4>
                      </div>
                      
                      <div className="space-y-3 mb-6 text-sm text-surface-600 bg-surface-50 p-4 rounded-lg">
                        
                        {Object.entries((msg as any).actionCard.args).map(([k, v]) => {
                           
const keyLabels: Record<string, string> = {
  campaign_name: 'Nazwa kampanii',
  message_content: 'Treść wiadomości',
  audience_tags: 'Grupa docelowa (Tagi)',
  channel: 'Kanał',
  scheduled_time: 'Czas wysyłki',
  target_scope: 'Zakres rezerwacji',
  confirmation_method: 'Metoda potwierdzania',
  target_datetime: 'Termin okienka',
  service_name: 'Nazwa usługi [będzie wpisana do wiadomości automatycznie]'
};
const valLabels: Record<string, string> = {
  tomorrow_appointments: 'Rezerwacje z jutra',
  sms_two_way: 'SMS Dwukierunkowy (TAK/NIE)',
  now: 'Teraz',
  sms: 'SMS'
};


const label = keyLabels[k] || k;
const val = typeof v === 'string' ? v : String(v);

let inputElement;

if (k === 'channel') {
  const isNps = (msg as any).actionCard.toolName === 'send_nps_surveys';
  const isReactivation = (msg as any).actionCard.toolName === 'create_informational_campaign' && ((msg as any).actionCard.args?.audience_tags || '').includes('uśpieni');
  const isLastMinute = (msg as any).actionCard.toolName === 'create_last_minute_offer';
  const smsOnly = isNps || isReactivation || isLastMinute;

  inputElement = (
    <select value={val} onChange={e => updateActionCardArg(msg.id, k, e.target.value)} className="flex-1 p-2 border border-surface-200 rounded text-sm bg-white focus:outline-none focus:border-gold-300">
      <option value="sms">SMS</option>
      {!smsOnly && <option value="voice_call">Telefon (Voice)</option>}
    </select>
  );
} else if (k === 'scheduled_time') {
  inputElement = (
    <select value={val} onChange={e => updateActionCardArg(msg.id, k, e.target.value)} className="flex-1 p-2 border border-surface-200 rounded text-sm bg-white focus:outline-none focus:border-gold-300">
      <option value="now">Teraz</option>
      <option value="tomorrow">Jutro</option>
      <option value="next_week">W przyszłym tygodniu</option>
    </select>
  );
} else if (k === 'target_scope') {
  inputElement = (
    <select value={val} onChange={e => updateActionCardArg(msg.id, k, e.target.value)} className="flex-1 p-2 border border-surface-200 rounded text-sm bg-white focus:outline-none focus:border-gold-300">
      <option value="tomorrow_appointments">Rezerwacje z jutra</option>
      <option value="all_unconfirmed">Wszystkie niepotwierdzone</option>
    </select>
  );
} else if (k === 'confirmation_method') {
  inputElement = (
    <select value={val} onChange={e => updateActionCardArg(msg.id, k, e.target.value)} className="flex-1 p-2 border border-surface-200 rounded text-sm bg-white focus:outline-none focus:border-gold-300">
      <option value="sms_two_way">SMS Dwukierunkowy (TAK/NIE)</option>
      <option value="voice_call">Telefon (Rozmowa z EVA)</option>
    </select>
  );
} else if (k === 'service_name') {
  inputElement = (
    <select 
      value={val} 
      onChange={e => updateActionCardArg(msg.id, k, e.target.value)} 
      className="flex-1 p-2 border border-surface-200 rounded text-sm bg-white focus:outline-none focus:border-gold-300"
    >
      <option value="">-- Wybierz usługę --</option>
      {availableServices.map(s => (
        <option key={s.id} value={s.name}>{s.name}</option>
      ))}
    </select>
  );
} else if (k === 'audience_tags') {
  const currentTags = val ? val.split(',').map(t => t.trim()).filter(Boolean) : [];
  inputElement = (
    <div className="flex flex-col gap-2 w-full">
      <div className="relative group/dropdown">
        <div className="w-full p-2 border border-surface-200 rounded text-sm bg-white cursor-pointer hover:border-gold-300 flex justify-between items-center">
          <span className="truncate text-surface-600">
            {currentTags.length > 0 ? currentTags.join(', ') : 'Wybierz tagi...'}
          </span>
          <span className="text-surface-400 text-xs">▼</span>
        </div>
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all z-10 max-h-48 overflow-y-auto">
          {availableTags.map(tag => {
            const isSelected = currentTags.includes(tag);
            return (
              <div 
                key={tag}
                className="px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 cursor-pointer flex items-center gap-2"
                onClick={() => {
                  let newTags;
                  if (isSelected) newTags = currentTags.filter(t => t !== tag);
                  else newTags = [...currentTags, tag];
                  updateActionCardArg(msg.id, k, newTags.join(', '));
                }}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'bg-gold-500 border-gold-500' : 'border-surface-300'}`}>
                  {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                {tag}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} else if (k === 'target_datetime') {
  let formattedVal = '';
  if (val) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const offset = d.getTimezoneOffset() * 60000;
      formattedVal = new Date(d.getTime() - offset).toISOString().slice(0, 16);
    }
  }
  inputElement = (
    <input 
      type="datetime-local" 
      value={formattedVal}
      onChange={e => {
        if (e.target.value) {
          const d = new Date(e.target.value);
          if(!isNaN(d.getTime())) updateActionCardArg(msg.id, k, d.toISOString());
        }
      }}
      className="flex-1 p-2 border border-surface-200 rounded text-sm bg-white focus:outline-none focus:border-gold-300 w-full"
    />
  );
} else {
  inputElement = (
    <textarea value={val} onChange={e => updateActionCardArg(msg.id, k, e.target.value)} rows={k === 'message_content' ? 4 : (k === 'campaign_name' ? 2 : 1)} className="flex-1 p-2 border border-surface-200 rounded text-sm bg-white resize-y focus:outline-none focus:border-gold-300 w-full" />
  );
}

return (
  <div key={k} className="flex flex-col sm:flex-row sm:gap-4 sm:items-start">
    <span className="font-medium text-surface-900 min-w-[150px] mt-2">{label}:</span>
    <div className="flex-1 w-full">
      {inputElement}
    </div>
  </div>
);
})}

                      </div>

                      <div className="flex gap-3">
                        <button 
                          onClick={() => executeActionCard(msg.id, (msg as any).actionCard)}
                          disabled={(msg as any)._loading}
                          className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                          {(msg as any)._loading ? 'Uruchamianie...' : 'Zatwierdź i Uruchom'}
                        </button>
                        <button 
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
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex max-w-[95%] md:max-w-[85%]">
                <div className="py-2 text-sm leading-relaxed text-surface-500">
                  <div className="flex items-center mb-1.5 text-gold-600">
                    <Bot size={14} />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 className="w-4 h-4 animate-spin text-gold-500" />
                    <span>Analizuję...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-surface-100 z-10 relative">
          
          <form onSubmit={handleSend} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Napisz do EVA..."
              disabled={isLoading}
              autoFocus
              className="w-full pl-5 pr-14 py-4 rounded-xl border border-surface-200 focus:outline-none focus:border-gold-300 focus:ring-4 focus:ring-gold-100 transition-all text-sm shadow-sm"
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-gold-50 text-gold-600 rounded-lg hover:bg-gold-100 disabled:opacity-50 disabled:hover:bg-gold-50 transition-colors"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
        
        {/* Dekoracyjne tło pod spodem */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold-50/50 via-transparent to-transparent -z-0"></div>
      </div>
    </div>
  );
}
