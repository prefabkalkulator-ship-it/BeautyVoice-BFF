const fs = require('fs');
let code = fs.readFileSync('src/services/voice/CallOrchestrator.ts', 'utf8');

const search = `               if (task) {
                  contextText = \`UWAGA: To jest połączenie wychodzące, które TY (asystentka) wykonujesz! Klient (\${task.customerName || task.targetPhone}) właśnie odebrał. CEL ROZMOWY: \${task.messageContent}. MUSISZ NATYCHMIAST PRZEMÓWIĆ JAKO PIERWSZA, zanim klient coś powie!\`;`;

const replace = `               if (task) {
                  const payload = typeof task.payload === 'object' && task.payload !== null ? task.payload as any : {};
                  contextText = \`UWAGA: To jest połączenie wychodzące, które TY (asystentka) wykonujesz! Klient (\${payload.customerName || task.targetPhone}) właśnie odebrał. CEL ROZMOWY: \${payload.messageContent}. MUSISZ NATYCHMIAST PRZEMÓWIĆ JAKO PIERWSZA, zanim klient coś powie!\`;`;

code = code.replace(search, replace);
fs.writeFileSync('src/services/voice/CallOrchestrator.ts', code, 'utf8');
