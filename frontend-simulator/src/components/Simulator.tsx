import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function Simulator() {
  const [sub, setSub] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(true);

  useEffect(() => {
    fetch('/api/subscription')
      .then(res => res.json())
      .then(data => { setSub(data); setSubLoading(false); })
      .catch(() => setSubLoading(false));
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
    scrollToBottom();
  }, [messages]);


  
              
  if (subLoading) {
    return (
      <div className="flex items-center justify-center p-12 h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (sub?.planName !== 'premium') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[70vh]">
        <div className="w-20 h-20 bg-gold-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold-500"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h2 className="text-3xl font-serif text-surface-900 mb-4 tracking-tight">Marketing AI</h2>
        <p className="text-surface-600 max-w-xl mx-auto mb-4 text-lg">Ta funkcja jest dostępna w pakiecie Premium. Otwórz potencjał zautomatyzowanych kampanii sprzedażowych i pozwól asystentce EVA generować zysk dla Ciebie.</p>
        <ul className="text-left text-surface-600 space-y-2 mb-8 max-w-lg mx-auto">
          <li className="flex items-start gap-2">✓ <span>Automatyczne SMSy i telefony, przypomnienia, wypełnianie luk w kalendarzu.</span></li>
          <li className="flex items-start gap-2">✓ <span>Spersonalizowane akcje reklamowe do stałych (lojalnych) klientów.</span></li>
          
        </ul>
        <a href="/dashboard/subscription" className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-medium shadow-md hover:shadow-lg hover:bg-primary/90 transition-all">
          Rozszerz pakiet
        </a>
      </div>
    );
  }
  
  
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
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, _loading: false, _executed: true, content: 'Uruchomiono pomyślnie!' } as any : m));
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
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: updatedMessages
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
                        <button onClick={() => handleSendDirect("Mamy wolne miejsce na dzisiaj na 16:00, stwórz ofertę Last Minute!")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">🚀 Oferta Last Minute</button>
                        <button onClick={() => handleSendDirect("Wyślij ankiety NPS do klientów, którzy byli u nas wczoraj")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">⭐️ Badanie NPS (Wczoraj)</button>
                        <button onClick={() => handleSendDirect("Wyślij zniżkę na powrót do uśpionych klientów (brak wizyty od 90 dni)")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">♻️ Wybudź klientów</button>
                        <button onClick={() => handleSendDirect("Potwierdź jutrzejsze wizyty sms-em")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all text-left">🗓 Potwierdź wizyty</button>
                      </div>
                  )}
                  {(msg as any).actionCard && !(msg as any)._executed && (
                    <div className="mt-4 p-5 bg-white border border-gold-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold-600">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        </div>
                        <h4 className="font-serif text-lg text-surface-900">Karta Akcji: {(msg as any).actionCard.toolName === 'create_informational_campaign' ? 'Nowa Kampania' : ((msg as any).actionCard.toolName === 'create_last_minute_offer' ? 'Oferta Last Minute' : 'Weryfikacja Rezerwacji')}</h4>
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
  target_datetime: 'Termin okienka'
};
const valLabels: Record<string, string> = {
  tomorrow_appointments: 'Wizyty z jutra',
  sms_two_way: 'SMS Dwukierunkowy (TAK/NIE)',
  now: 'Teraz',
  sms: 'SMS'
};


const label = keyLabels[k] || k;
const val = typeof v === 'string' ? v : String(v);

let inputElement;

if (k === 'channel') {
  inputElement = (
    <select value={val} onChange={e => updateActionCardArg(msg.id, k, e.target.value)} className="flex-1 p-2 border border-surface-200 rounded text-sm bg-white focus:outline-none focus:border-gold-300">
      <option value="sms">SMS</option>
      <option value="voice_call">Telefon (Voice)</option>
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
      <option value="tomorrow_appointments">Wizyty z jutra</option>
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
