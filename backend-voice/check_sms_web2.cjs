const fs = require('fs');
const code = fs.readFileSync('src/app.ts', 'utf8').split('\n');
const m = code.findIndex(l => l.includes('/api/zadarma-sms'));
console.log(code.slice(m+30, m+70).join('\n'));
