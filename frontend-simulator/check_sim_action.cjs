const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8').split('\n');
let m = code.findIndex(l => l.includes('Zatwierdź i Uruchom'));
console.log(code.slice(m-10, m+10).join('\n'));
