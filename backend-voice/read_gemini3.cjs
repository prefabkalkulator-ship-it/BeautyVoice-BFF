const fs = require('fs');
let code = fs.readFileSync('src/services/GeminiService.ts', 'utf8');
let start = code.indexOf("ai.chats.create(");
let end = code.indexOf("return responseText;");
console.log(code.substring(start, end + 20));
