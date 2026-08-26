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


  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Dzień dobry! Z tej strony EVA, wirtualna asystentka. W czym mogę pomóc?' }
  ]);
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
      </div>

      <div className="flex-1 glass-card rounded-2xl flex flex-col overflow-hidden border border-surface-200/60 shadow-lg relative max-w-3xl mx-auto w-full mt-4">
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-24 space-y-6 bg-[#fafafa]/50 relative z-10">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="flex max-w-[95%] md:max-w-[85%]">
                
                {msg.role === 'user' ? (
                  <div className="p-3.5 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-sm leading-relaxed shadow-sm">
                    <div className="flex items-center mb-1.5 text-primary-foreground/70">
                      <User size={14} />
                    </div>
                    {msg.content}
                  </div>
                ) : (
                  <div className="py-2 text-sm leading-relaxed text-surface-800">
                    <div className="flex items-center mb-1.5 text-gold-600">
                      <Bot size={14} />
                    </div>
                    
                  {msg.content}
                  {(msg as any).actionCard && !(msg as any)._executed && (
                    <div className="mt-4 p-5 bg-white border border-gold-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold-600">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        </div>
                        <h4 className="font-serif text-lg text-surface-900">Karta Akcji: {(msg as any).actionCard.toolName === 'create_informational_campaign' ? 'Nowa Kampania' : 'Weryfikacja Rezerwacji'}</h4>
                      </div>
                      
                      <div className="space-y-3 mb-6 text-sm text-surface-600 bg-surface-50 p-4 rounded-lg">
                        {Object.entries((msg as any).actionCard.args).map(([k, v]) => (
                           <div key={k} className="flex flex-col sm:flex-row sm:gap-4">
                             <span className="font-medium text-surface-900 min-w-[120px]">{k}:</span>
                             <span className="break-words">{String(v)}</span>
                           </div>
                        ))}
                      </div>

                      <div className="flex gap-3">
                        <button 
                          onClick={() => executeActionCard(msg.id, (msg as any).actionCard)}
                          disabled={(msg as any)._loading}
                          className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                          {(msg as any)._loading ? 'Uruchamianie...' : 'Zatwierdź i Uruchom'}
                        </button>
                        <button className="px-4 py-2 text-surface-500 hover:text-surface-700 font-medium transition-colors">
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
