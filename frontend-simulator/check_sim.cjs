const fs = require('fs');
const code = fs.readFileSync('src/components/Simulator.tsx', 'utf8').split('\n');
const m = code.findIndex(l => l.includes('ActionCard'));
console.log(code.slice(m-10, m+40).join('\n'));
