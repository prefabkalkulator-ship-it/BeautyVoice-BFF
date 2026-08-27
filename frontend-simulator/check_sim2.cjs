const fs = require('fs');
const code = fs.readFileSync('src/components/Simulator.tsx', 'utf8').split('\n');
const m = code.findIndex(l => l.includes('(msg as any).actionCard'));
console.log(code.slice(m-5, m+35).join('\n'));
