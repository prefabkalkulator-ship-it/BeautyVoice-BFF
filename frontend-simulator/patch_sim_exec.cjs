const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

const injection = `
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
`;

code = code.replace(
  'const handleSend = async',
  injection + '\n  const handleSend = async'
);

fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
