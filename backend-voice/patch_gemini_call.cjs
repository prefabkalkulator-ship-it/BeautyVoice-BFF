const fs = require('fs');
let code = fs.readFileSync('src/services/GeminiService.ts', 'utf8');
code = code.replace(
  'systemInstruction: getSystemPrompt(tenantName, businessProfile),',
  'systemInstruction: getSystemPrompt(tenantName, businessProfile, (tenant as any).reviewLink),'
);
fs.writeFileSync('src/services/GeminiService.ts', code, 'utf8');
