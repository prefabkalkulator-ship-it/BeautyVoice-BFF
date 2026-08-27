const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

// Update messages map inside Simulator
const injectionUpdateArg = `
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
`;

code = code.replace(/const executeActionCard = async/, injectionUpdateArg + '\n  const executeActionCard = async');

const mapRegex = /const label = keyLabels\[k\] \|\| k;\s*const displayValue = typeof v === 'string' && valLabels\[v\] \? valLabels\[v\] : String\(v\);\s*return \(\s*<div key=\{k\} className="flex flex-col sm:flex-row sm:gap-4">\s*<span className="font-medium text-surface-900 min-w-\[150px\]">\{label\}:<\/span>\s*<span className="break-words">\{displayValue\}<\/span>\s*<\/div>\s*\);\s*}\)/;

const newInputMap = `
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
    <textarea value={val} onChange={e => updateActionCardArg(msg.id, k, e.target.value)} rows={k === 'message_content' ? 3 : 1} className="flex-1 p-2 border border-surface-200 rounded text-sm bg-white resize-y focus:outline-none focus:border-gold-300 w-full" />
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
})`;

code = code.replace(mapRegex, newInputMap);
fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
