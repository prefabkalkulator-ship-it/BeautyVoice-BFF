const fs = require('fs');
const code = fs.readFileSync('src/services/GeminiService.ts', 'utf8').split('\n');
const m = code.findIndex(l => l.includes('handleChat'));
console.log(code.slice(m+40, m+100).join('\n'));
