const fs = require('fs');
const code = fs.readFileSync('src/app.ts', 'utf8').split('\n');
console.log(code.filter(l => l.includes('app.post')).join('\n'));
