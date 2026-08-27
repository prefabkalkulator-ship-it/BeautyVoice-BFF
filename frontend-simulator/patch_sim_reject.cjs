const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

// 1. Zmiana mapowania kluczy i WARTOŚCI:
const mapRegex = /const labels: Record<string, string> = {[\s\S]*?const label = labels\[k\] \|\| k;\s*return \([\s\S]*?<\/div>\s*\);\s*}\)/;

const newMapping = `
const keyLabels: Record<string, string> = {
  campaign_name: 'Nazwa kampanii',
  message_content: 'Treść wiadomości',
  audience_tags: 'Grupa docelowa (Tagi)',
  channel: 'Kanał',
  scheduled_time: 'Czas wysyłki',
  target_scope: 'Zakres rezerwacji',
  confirmation_method: 'Metoda potwierdzania'
};
const valLabels: Record<string, string> = {
  tomorrow_appointments: 'Wizyty z jutra',
  sms_two_way: 'SMS Dwukierunkowy (TAK/NIE)',
  now: 'Teraz',
  sms: 'SMS'
};

const label = keyLabels[k] || k;
const displayValue = typeof v === 'string' && valLabels[v] ? valLabels[v] : String(v);

return (
  <div key={k} className="flex flex-col sm:flex-row sm:gap-4">
    <span className="font-medium text-surface-900 min-w-[150px]">{label}:</span>
    <span className="break-words">{displayValue}</span>
  </div>
);
})`;

code = code.replace(mapRegex, newMapping);

// 2. Naprawa przycisku "Odrzuć"
// Odszukaj button "Odrzuć"
const rejectRegex = /<button\s*className="px-4 py-2 bg-surface-100 hover:bg-surface-200 text-surface-700 text-sm font-medium rounded-lg transition-colors">\s*Odrzuć\s*<\/button>/;

const newReject = `<button onClick={() => {
  const newMsgs = [...messages];
  const idx = newMsgs.findIndex(m => m.id === msg.id);
  if (idx !== -1) {
    (newMsgs[idx] as any)._executed = true;
    newMsgs.push({ id: Date.now().toString(), role: 'assistant', content: 'Akcja została anulowana.' });
    setMessages(newMsgs);
  }
}} className="px-4 py-2 bg-surface-100 hover:bg-surface-200 text-surface-700 text-sm font-medium rounded-lg transition-colors">Odrzuć</button>`;

code = code.replace(rejectRegex, newReject);

fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
