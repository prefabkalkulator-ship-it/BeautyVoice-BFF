const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

const injectionInit = `
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('marketing_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch(e) {}
    }
    return [
      { id: '1', role: 'assistant', content: 'Dzień dobry! Z tej strony EVA, wirtualna asystentka. W czym mogę pomóc?' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('marketing_chat_history', JSON.stringify(messages));
  }, [messages]);
`;

code = code.replace(
  'const [messages, setMessages] = useState<Message[]>([\n    { id: \'1\', role: \'assistant\', content: \'Dzień dobry! Z tej strony EVA, wirtualna asystentka. W czym mogę pomóc?\' }\n  ]);',
  injectionInit
);

fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
