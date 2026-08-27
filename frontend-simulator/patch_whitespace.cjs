const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

// The user message div:
code = code.replace(
  'className="p-3.5 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-sm leading-relaxed shadow-sm"',
  'className="p-3.5 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-sm leading-relaxed shadow-sm whitespace-pre-wrap"'
);

// The assistant message div:
code = code.replace(
  'className="py-2 text-sm leading-relaxed text-surface-800"',
  'className="py-2 text-sm leading-relaxed text-surface-800 whitespace-pre-wrap"'
);

fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
