const fs = require('fs');
const code = fs.readFileSync('src/app.ts', 'utf8').split('\n');
const m = code.findIndex(l => l.includes('schedule_confirmation_flow'));
console.log(code.slice(m-2, m+30).join('\n'));
