const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8').split('\n');
let m = code.findIndex(l => l.includes('schedule_confirmation_flow'));
console.log(code.slice(m, m+30).join('\n'));
