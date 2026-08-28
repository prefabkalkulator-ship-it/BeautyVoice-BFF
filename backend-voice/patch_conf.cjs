const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');

const search = `    if (toolName === 'schedule_confirmation_flow') {
      // Dla uproszczenia: wysłanie SMSa do jutrzejszych rezerwacji
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowEnd = new Date(tomorrow);
      tomorrow.setHours(0,0,0,0);
      tomorrowEnd.setHours(23,59,59,999);

      const appointments = await prisma.appointment.findMany({
        where: { tenantId: tenant.id, startTime: { gte: tomorrow, lte: tomorrowEnd }, status: 'confirmed' }
      });

      let added = 0;
      for (const appt of appointments) {
         if (!appt.customerPhone) continue;
         const text = \`Przypomnienie: masz zaplanowaną rezerwację na jutro (godz. \${appt.startTime.toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit', timeZone:'Europe/Warsaw'})}). Odpisz TAK by potwierdzić, lub ANULUJ by zrezygnować.\`;
         
         await prisma.outboundQueue.create({
          data: {
            tenantId: tenant.id,
            targetPhone: appt.customerPhone,
            channel: 'sms',
            payload: { appointmentId: appt.id, text },
            status: 'pending',
            scheduledFor: new Date()
          }
        });
        added++;
      }
      return res.json({ success: true, message: \`Kolejka zasilana (\${added} rezerwacji z jutra).\` });
    }`;

const replace = `    if (toolName === 'schedule_confirmation_flow') {
      const { confirmation_method } = args;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowEnd = new Date(tomorrow);
      tomorrow.setHours(0,0,0,0);
      tomorrowEnd.setHours(23,59,59,999);

      const appointments = await prisma.appointment.findMany({
        where: { tenantId: tenant.id, startTime: { gte: tomorrow, lte: tomorrowEnd }, status: 'confirmed' }
      });

      let added = 0;
      for (const appt of appointments) {
         if (!appt.customerPhone) continue;
         
         let text = '';
         let channel = 'sms';
         
         if (confirmation_method === 'voice_call' || confirmation_method === 'voice') {
           channel = 'voice';
           text = \`Dzwonisz do klienta by przypomnieć i poprosić o potwierdzenie rezerwacji, która odbędzie się jutro o godz. \${appt.startTime.toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit', timeZone:'Europe/Warsaw'})}.\`;
         } else {
           text = \`Przypomnienie: masz zaplanowaną rezerwację na jutro (godz. \${appt.startTime.toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit', timeZone:'Europe/Warsaw'})}). Odpisz TAK by potwierdzić, lub ANULUJ by zrezygnować.\`;
         }
         
         await prisma.outboundQueue.create({
          data: {
            tenantId: tenant.id,
            targetPhone: appt.customerPhone,
            channel: channel,
            payload: { appointmentId: appt.id, text: text, customerName: appt.customerName },
            status: 'pending',
            scheduledFor: new Date()
          }
        });
        added++;
      }
      return res.json({ success: true, message: \`Kolejka zasilana (\${added} rezerwacji z jutra).\` });
    }`;

code = code.replace(search, replace);
fs.writeFileSync('src/app.ts', code, 'utf8');
