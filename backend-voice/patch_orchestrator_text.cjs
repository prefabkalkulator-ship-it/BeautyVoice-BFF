const fs = require('fs');
let code = fs.readFileSync('src/services/voice/CallOrchestrator.ts', 'utf8');

const search = `payload.messageContent`;
const replace = `payload.text`;
code = code.replace(search, replace);

fs.writeFileSync('src/services/voice/CallOrchestrator.ts', code, 'utf8');
