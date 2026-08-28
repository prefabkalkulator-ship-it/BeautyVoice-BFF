const fs = require('fs');
let code = fs.readFileSync('src/services/voice/CallOrchestrator.ts', 'utf8');
let start = code.indexOf("private async handleTwilioMessage(");
console.log(code.substring(start, start + 1200));
