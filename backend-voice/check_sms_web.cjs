const fs = require('fs');
const code = fs.readFileSync('src/app.ts', 'utf8').split('\n');
const m = code.findIndex(l => l.includes('/api/zadarma-sms'));
console.log(code.slice(m, m+30).join('\n'));
