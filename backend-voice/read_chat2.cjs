const fs = require('fs');
const code = fs.readFileSync('src/controllers/WebhookController.ts', 'utf8').split('\n');
const m = code.findIndex(l => l.includes('handleIncomingChat'));
console.log(code.slice(m-2, m+30).join('\n'));
