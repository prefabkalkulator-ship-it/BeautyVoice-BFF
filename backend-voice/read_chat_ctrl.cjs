const fs = require('fs');
const code = fs.readFileSync('src/index.ts', 'utf8').split('\n');
const m = code.findIndex(l => l.includes('handleIncomingChat'));
console.log(code.slice(m-2, m+50).join('\n'));
