import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function Simulator() {
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
          <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Symulator AI</h2>
          <p className="text-surface-500 mt-1">Przetestuj logikę asystentki bezpośrednio w przeglądarce przed wdrożeniem połączeń głosowych.</p>
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
