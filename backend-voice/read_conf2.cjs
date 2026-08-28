const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');
let start = code.indexOf("if (toolName === 'schedule_confirmation_flow')");
console.log(code.substring(start, start + 1200));
