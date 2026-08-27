const fs = require('fs');
const code = fs.readFileSync('src/app.ts', 'utf8').split('\n');
const m = code.findIndex(l => l.includes('create_informational_campaign'));
console.log(code.slice(m, m+40).join('\n'));
