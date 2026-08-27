const fs = require('fs');
let code = fs.readFileSync('src/services/GeminiService.ts', 'utf8');
let start = code.indexOf("public async handleChat(");
console.log(code.substring(start, start + 300));
