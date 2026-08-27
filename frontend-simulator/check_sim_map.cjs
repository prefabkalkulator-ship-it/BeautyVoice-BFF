const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8').split('\n');
let m = code.findIndex(l => l.includes('Object.entries('));
console.log(code.slice(m-2, m+20).join('\n'));
