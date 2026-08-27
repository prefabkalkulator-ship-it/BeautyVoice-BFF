const fs = require('fs');
const code = fs.readFileSync('src/app.ts', 'utf8').split('\n');
const m = code.findIndex(l => l.includes('/api/chat') && l.includes('app.post'));
console.log(code.slice(m, m+40).join('\n'));
