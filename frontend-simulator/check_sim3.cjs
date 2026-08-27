const fs = require('fs');
const code = fs.readFileSync('src/components/Simulator.tsx', 'utf8').split('\n');
const m = code.findIndex(l => l.includes('executeActionCard ='));
console.log(code.slice(m, m+25).join('\n'));
