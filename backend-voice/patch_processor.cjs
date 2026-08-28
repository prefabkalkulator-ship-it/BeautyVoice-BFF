const fs = require('fs');
let code = fs.readFileSync('src/jobs/OutboundProcessor.ts', 'utf8');

code = code.replace(
  "import { SMSService } from '../services/sms/SMSService';",
  "import { SMSService } from '../services/sms/SMSService';\nimport { VoiceOutboundService } from '../services/voice/VoiceOutboundService';"
);

const search = `        } else if (task.channel === 'voice') {
          // Tutaj w przyszłości integracja API Zadarma / Twilio do wykonania automatycznego calla do bota.
          // Zastępczo oznaczamy jako zrobione.
          console.log(\`[OutboundProcessor] Symulacja Voice Call do: \${task.targetPhone}\`);
          await prisma.outboundQueue.update({
            where: { id: task.id },
            data: { status: 'done', processedAt: new Date(), errorMessage: 'Symulacja (brak wdrożonego API do inicjacji Voice)' }
          });
        }`;

const replace = `        } else if (task.channel === 'voice') {
          console.log(\`[OutboundProcessor] Inicjowanie Voice Outbound Call do: \${task.targetPhone}\`);
          const success = await VoiceOutboundService.initiateCall(task.id, task.targetPhone);
          
          if (success) {
            await prisma.outboundQueue.update({
              where: { id: task.id },
              // Pozostawiamy status 'pending' albo dajemy 'in_progress', żeby CallOrchestrator mógł go podjąć.
              // Zróbmy 'in_progress' żeby job tego nie przetwarzał wielokrotnie.
              data: { status: 'in_progress' }
            });
          } else {
            await prisma.outboundQueue.update({
              where: { id: task.id },
              data: { status: 'failed', processedAt: new Date(), errorMessage: 'Błąd API Zadarma przy inicjacji' }
            });
          }
        }`;

code = code.replace(search, replace);

fs.writeFileSync('src/jobs/OutboundProcessor.ts', code, 'utf8');
