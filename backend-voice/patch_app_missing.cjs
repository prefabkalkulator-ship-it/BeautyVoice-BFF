const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');

const searchNps = `    if (toolName === 'create_last_minute_offer') {`;
const replaceNps = `    if (toolName === 'send_nps_surveys') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);
        
        const apps = await prisma.appointment.findMany({
          where: {
            tenantId: tenant.id,
            endTime: { gte: yesterday, lte: endOfYesterday },
            surveySent: false,
            status: { not: 'cancelled' }
          }
        });

        if (apps.length === 0) {
          return res.json({ success: true, message: 'Brak nowych wizyt do wysłania ankiet.' });
        }

        for (const app of apps) {
          await prisma.outboundQueue.create({
            data: {
              tenantId: app.tenantId,
              targetPhone: app.customerPhone,
              channel: 'sms',
              payload: { text: "Dziękujemy za wczorajszą wizytę! Jak oceniasz nasze usługi w skali od 1 do 5? Odpisz oceniając naszą pracę!" },
              status: 'pending',
              scheduledFor: new Date()
            }
          });
          await prisma.appointment.update({
            where: { id: app.id },
            data: { surveySent: true }
          });
        }
        return res.json({ success: true, message: \`Kolejka zasilona (\${apps.length} ankiet).\` });
    } else if (toolName === 'create_last_minute_offer') {`;

code = code.replace(searchNps, replaceNps);
fs.writeFileSync('src/app.ts', code, 'utf8');
