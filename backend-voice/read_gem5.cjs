const fs = require('fs');
let code = fs.readFileSync('src/services/GeminiService.ts', 'utf8');
let start = code.indexOf("name === 'bookAppointment'");
console.log(code.substring(start - 50, start + 500));
