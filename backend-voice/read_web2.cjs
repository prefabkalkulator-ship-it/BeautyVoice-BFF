const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8').split('\n');
let start = code.findIndex(l => l.includes('POTWIERDZAM'));
console.log(code.slice(start, start+45).join('\n'));
