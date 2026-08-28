const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

const oldGreeting = "Dzień dobry! Z tej strony EVA, wirtualna asystentka. W czym mogę pomóc?\\n\\nPrzykładowe komendy:\\n• \\\"Wyślij przypomnienie z 10% rabatu do klientów z tagiem #lojalny, kanał sms\\\"\\n• \\\"Uruchom potwierdzanie jutrzejszych rezerwacji SMSem\\\"";
const newGreeting = "Dzień dobry! Z tej strony EVA. Użyj poniższych przycisków, by uruchomić gotowe kampanie, lub po prostu napisz do mnie, co chcesz osiągnąć.";

code = code.replace(/`Dzie.*SMSem`/g, '`' + newGreeting + '`');

const searchForm = `        <div className="p-4 bg-white border-t border-surface-100 z-10 relative">
          <form onSubmit={handleSend} className="relative">`;

const replaceForm = `        <div className="p-4 bg-white border-t border-surface-100 z-10 relative">
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => handleSendDirect("Mamy wolne miejsce na dzisiaj na 16:00, stwórz ofertę Last Minute!")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all">🚀 Oferta Last Minute</button>
              <button onClick={() => handleSendDirect("Wyślij ankiety NPS do klientów, którzy byli u nas wczoraj")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all">⭐️ Badanie NPS (Wczoraj)</button>
              <button onClick={() => handleSendDirect("Wyślij zniżkę na powrót do uśpionych klientów (brak wizyty od 90 dni)")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all">♻️ Wybudź klientów</button>
              <button onClick={() => handleSendDirect("Potwierdź jutrzejsze wizyty sms-em")} className="text-xs font-medium px-3 py-2 bg-surface-50 border border-surface-200 text-surface-700 hover:bg-gold-50 hover:border-gold-300 hover:text-gold-700 rounded-full transition-all">🗓 Potwierdź wizyty</button>
            </div>
          )}
          <form onSubmit={handleSend} className="relative">`;

code = code.replace(searchForm, replaceForm);

const searchHandleSend = `const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;`;
    
const replaceHandleSend = `const handleSendDirect = async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
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
    if (!input.trim() || isLoading) return;`;

code = code.replace(searchHandleSend, replaceHandleSend);

fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
