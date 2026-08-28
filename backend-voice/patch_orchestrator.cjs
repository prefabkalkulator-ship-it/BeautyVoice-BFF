const fs = require('fs');
let code = fs.readFileSync('src/services/voice/CallOrchestrator.ts', 'utf8');

const searchParams = `          const callerPhone = data.start.customParameters?.callerPhone || 'unknown';
          
          setTimeout(async () => {
            let contextText = '';
            if (callerPhone !== 'unknown' && this.geminiClient) {
              try {
                if (this.tenantId) {
                  const lastAppt = await prisma.appointment.findFirst({`;

const replaceParams = `          const callerPhone = data.start.customParameters?.callerPhone || 'unknown';
          const outboundTaskId = data.start.customParameters?.outboundTaskId;
          
          setTimeout(async () => {
            let contextText = '';
            if (outboundTaskId && this.tenantId) {
               // OUTBOUND CALL LOGIC
               const task = await prisma.outboundQueue.findUnique({ where: { id: outboundTaskId } });
               if (task) {
                  contextText = \`UWAGA: To jest połączenie wychodzące, które TY (asystentka) wykonujesz! Klient (\${task.customerName || task.targetPhone}) właśnie odebrał. CEL ROZMOWY: \${task.messageContent}. MUSISZ NATYCHMIAST PRZEMÓWIĆ JAKO PIERWSZA, zanim klient coś powie!\`;
                  // Oznacz task jako zakończony
                  await prisma.outboundQueue.update({ where: { id: task.id }, data: { status: 'done', processedAt: new Date() } });
               }
            } else if (callerPhone !== 'unknown' && this.geminiClient) {
              // INBOUND CALL LOGIC
              try {
                if (this.tenantId) {
                  const lastAppt = await prisma.appointment.findFirst({`;

code = code.replace(searchParams, replaceParams);
fs.writeFileSync('src/services/voice/CallOrchestrator.ts', code, 'utf8');
