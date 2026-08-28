const fs = require('fs');
let code = fs.readFileSync('src/controllers/WebhookController.ts', 'utf8');
let start = code.indexOf("handleIncomingChat(");
console.log(code.substring(start, start + 800));
