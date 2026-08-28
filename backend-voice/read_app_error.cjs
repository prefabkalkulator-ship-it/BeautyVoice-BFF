const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');
let lines = code.split('\n');
console.log(lines.slice(250, 270).join('\n'));
