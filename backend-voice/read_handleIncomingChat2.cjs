const fs = require('fs');
let code = fs.readFileSync('src/controllers/WebhookController.ts', 'utf8');
let start = code.indexOf("res.status(200).json({");
console.log(code.substring(start, start + 300));
