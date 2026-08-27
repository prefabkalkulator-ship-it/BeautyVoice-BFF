const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');

code = code.replace(
  'const responseText = await geminiService.handleChat(message, history, tenant.id, tenant.name, tenant.businessProfile, undefined, (chunk) => {',
  'const responseText = await geminiService.handleChat(message, history, tenant.id, tenant.name, tenant.businessProfile, tenant.reviewLink, undefined, (chunk) => {'
);
code = code.replace(
  'const aiResponse = await geminiService.handleChat(message, history, tenant.id, tenant.name, tenant.businessProfile);',
  'const aiResponse = await geminiService.handleChat(message, history, tenant.id, tenant.name, tenant.businessProfile, tenant.reviewLink);'
);

fs.writeFileSync('src/app.ts', code, 'utf8');
