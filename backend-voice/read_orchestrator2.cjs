const fs = require('fs');
let code = fs.readFileSync('src/services/voice/CallOrchestrator.ts', 'utf8');
let start = code.indexOf("contextText = `Dzwoni nowy numer: ${callerPhone}.`;");
let end = code.indexOf("break;", start);
console.log(code.substring(start, end));
