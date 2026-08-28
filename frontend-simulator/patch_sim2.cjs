const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');
code = code.replace(
  'const updatedMessages = [...messages, userMsg];',
  'setInput("");\n    const updatedMessages = [...messages, userMsg];'
);
fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
