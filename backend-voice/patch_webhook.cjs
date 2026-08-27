const fs = require('fs');
let code = fs.readFileSync('src/controllers/WebhookController.ts', 'utf8');

code = code.replace(
  'const responseText = await geminiService.handleChat(message, history, tenant.id, tenant.name, tenant.businessProfile);',
  'const responseText = await geminiService.handleChat(message, history, tenant.id, tenant.name, tenant.businessProfile, tenant.reviewLink);'
);

fs.writeFileSync('src/controllers/WebhookController.ts', code, 'utf8');
