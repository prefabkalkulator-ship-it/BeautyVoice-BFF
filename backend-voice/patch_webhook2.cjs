const fs = require('fs');
let code = fs.readFileSync('src/controllers/WebhookController.ts', 'utf8');

code = code.replace(
  "const reply = await geminiService.handleChat(lastMessage, history, tenant.id, tenant.name, tenant.businessProfile || 'solo', onToolCall, onChunk);",
  "const reply = await geminiService.handleChat(lastMessage, history, tenant.id, tenant.name, tenant.businessProfile || 'solo', tenant.reviewLink, onToolCall, onChunk);"
);

code = code.replace(
  "const reply = await geminiService.handleChat(message, history || [], tenant.id, tenant.name, tenant.businessProfile || 'solo');",
  "const reply = await geminiService.handleChat(message, history || [], tenant.id, tenant.name, tenant.businessProfile || 'solo', tenant.reviewLink);"
);

fs.writeFileSync('src/controllers/WebhookController.ts', code, 'utf8');
