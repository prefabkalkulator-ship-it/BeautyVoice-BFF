const fs = require('fs');
let code = fs.readFileSync('src/services/GeminiService.ts', 'utf8');
const lines = code.split('\n');
let print = false;
let out = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('ai.chats.create')) print = true;
  if (print) out.push(lines[i]);
  if (print && lines[i].includes('return responseText')) break;
}
console.log(out.join('\n'));
