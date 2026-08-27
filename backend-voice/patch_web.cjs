const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');

const searchWeb = `    if ((bodyText === "TAK" || bodyText === "POTWIERDZAM") && callerPhone) {
      try {
        const upcomingList = await prisma.appointment.findMany({
          where: { 
            customerPhone: callerPhone, 
            status: 'confirmed', 
            startTime: { gt: new Date() } 
          },
          orderBy: { startTime: 'asc' },
          take: 1
        });
        
        if (upcomingList.length === 1) {
          const upcoming = upcomingList[0];
          await prisma.appointment.update({ where: { id: upcoming.id }, data: { status: 'confirmed_by_client' } });
          
          import('./services/sms/SMSService').then(sms => {
            sms.SMSService.sendSMS(callerPhone, \`Dziękujemy, Twoja wizyta została pomyślnie potwierdzona!\`).catch(console.error);
          });
          return res.send("OK");
        }
      } catch (err) {}
    }`;

const replaceWeb = `    if ((bodyText === "TAK" || bodyText === "POTWIERDZAM") && callerPhone) {
      try {
        const upcomingList = await prisma.appointment.findMany({
          where: { 
            customerPhone: callerPhone, 
            status: 'confirmed', 
            startTime: { gt: new Date() } 
          },
          orderBy: { startTime: 'asc' },
          take: 1
        });
        
        if (upcomingList.length === 1) {
          const upcoming = upcomingList[0];
          await prisma.appointment.update({ where: { id: upcoming.id }, data: { status: 'confirmed_by_client' } });
          
          import('./services/sms/SMSService').then(sms => {
            sms.SMSService.sendSMS(callerPhone, \`Dziękujemy, Twoja wizyta została pomyślnie potwierdzona!\`).catch(console.error);
          });
          return res.send("OK");
        }
        
        // Logika Last Minute (Kto pierwszy ten lepszy)
        const lastMinuteList = await prisma.appointment.findMany({
          where: {
            status: 'last_minute_offer',
            startTime: { gt: new Date() }
          },
          orderBy: { startTime: 'asc' },
          take: 1
        });
        
        if (lastMinuteList.length === 1) {
          const offer = lastMinuteList[0];
          // Pobierz imię klienta z bazy, jeśli istnieje, inaczej domyślne
          const cust = await prisma.customer.findFirst({ where: { phone: callerPhone, tenantId: offer.tenantId } });
          const nameToSave = cust ? cust.name : 'Klient Last Minute';
          const idToSave = cust ? cust.id : null;
          
          await prisma.appointment.update({
             where: { id: offer.id },
             data: { status: 'confirmed_by_client', customerPhone: callerPhone, customerName: nameToSave, customerId: idToSave }
          });
          
          import('./services/sms/SMSService').then(sms => {
            sms.SMSService.sendSMS(callerPhone, \`Zarejestrowano pomyślnie. Czekamy na Ciebie!\`).catch(console.error);
          });
          return res.send("OK");
        } else {
          // Brak ofert last minute (zostały wykupione lub brak)
          // Jeśli wiemy, że odpowiada na ofertę, wyślij odrzucenie
          import('./services/sms/SMSService').then(sms => {
            sms.SMSService.sendSMS(callerPhone, \`Przepraszamy, ale ten termin został już przed chwilą zarezerwowany. Zapraszamy do rezerwacji innych wolnych dat na naszej stronie!\`).catch(console.error);
          });
          return res.send("OK");
        }
        
      } catch (err) {}
    }`;

code = code.replace(searchWeb, replaceWeb);
fs.writeFileSync('src/app.ts', code, 'utf8');
