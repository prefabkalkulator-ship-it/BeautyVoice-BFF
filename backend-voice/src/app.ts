import express from 'express';
import cors from 'cors';
import { webhookController } from './controllers/WebhookController';
import { knowledgeService } from './services/KnowledgeExtractorService';
import { VoiceOutboundService } from './services/voice/VoiceOutboundService';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0'); res.setHeader('Surrogate-Control', 'no-store'); next(); });

app.use((req, res, next) => {
  (req as any).tenantId = req.headers['x-tenant-id'] || req.body?.tenantId || req.query?.tenantId;
  next();
});

async function getContextTenant(req: any) {
  const tid = req.tenantId;
  if (!tid || tid === '00000000-0000-0000-0000-000000000000') {
    return await prisma.tenant.findFirst({ where: { name: { not: 'DEMO' } } });
  }
  return await prisma.tenant.findUnique({ where: { id: tid } });
}

app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Endpoint używany przez asystenta głosowego (np. Vapi.ai) lub nasz frontendowy symulator
app.post('/api/chat', (req, res) => webhookController.handleIncomingChat(req, res));

// Endpoint specyficzny dla Custom LLM z Vapi.ai (wymaga standardu OpenAI)
app.post('/api/vapi-llm/chat/completions', (req, res) => webhookController.handleVapiCustomLLM(req, res));

// --- API dla PWA Dashboard ---
import { prisma } from './prisma';

app.get('/api/fix-db', async (req, res) => {
  const tenants = await prisma.tenant.findMany({ include: { subscription: true } });
  res.json({ tenants });
});

// Kampanie Wychodzące - Egzekucja
app.post('/api/campaigns/execute', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(403).json({ error: 'Brak dostępu' });

    const { toolName, args } = req.body;

    // Pobierz subskrypcje
    const sub = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
    if (sub?.planName !== 'premium') {
       // bypass w celach demonstracyjnych/testowych na ten moment zostawiamy otwarty lub ostrzegamy
       // return res.status(403).json({ error: 'Wymagany plan Premium' });
    }

    if (toolName === 'create_informational_campaign') {
      const { campaign_name, channel, audience_tags, message_content, scheduled_time } = args;
      
      const campaign = await prisma.campaign.create({
        data: {
          tenantId: tenant.id,
          name: campaign_name || 'Kampania Informacyjna',
          type: channel === 'voice_call' ? 'voice' : 'sms',
          status: 'scheduled',
          messageContent: message_content,
        }
      });

      let whereClause: any = { tenantId: tenant.id };
      if (audience_tags) {
        const tagsArray = audience_tags.split(',').map((t: string) => t.trim());
        const normalTags = tagsArray.filter(t => t.toLowerCase() !== '#uśpieni' && t.toLowerCase() !== 'uśpieni');
        
        if (normalTags.length > 0) {
           whereClause.tags = { hasSome: normalTags };
        }
        
        if (tagsArray.some(t => t.toLowerCase() === '#uśpieni' || t.toLowerCase() === 'uśpieni')) {
           const ninetyDaysAgo = new Date();
           ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
           whereClause.OR = [
             { lastVisitAt: { lt: ninetyDaysAgo } },
             { lastVisitAt: null, createdAt: { lt: ninetyDaysAgo } }
           ];
        }
      }

      const customers = await prisma.customer.findMany({ where: whereClause });

      // Dodaj do kolejki
      for (const cust of customers) {
        if (!cust.phone) continue;
        await prisma.outboundQueue.create({
          data: {
            tenantId: tenant.id,
            targetPhone: cust.phone,
            channel: channel === 'voice_call' ? 'voice' : 'sms',
            payload: { customerId: cust.id, campaignId: campaign.id, text: message_content },
            status: 'pending',
            scheduledFor: new Date()
          }
        });
      }

      return res.json({ success: true, customersCount: customers.length, campaignId: campaign.id });
    } 
    
    
    if (toolName === 'send_nps_surveys') {
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
        return res.json({ success: true, message: `Kolejka zasilona (${apps.length} ankiet).` });
    } else if (toolName === 'create_last_minute_offer') {
      const { campaign_name, audience_tags, message_content, target_datetime } = args;
      
      const campaign = await prisma.campaign.create({
        data: {
          tenantId: tenant.id,
          name: campaign_name || 'Last Minute Offer',
          type: 'sms',
          status: 'scheduled',
          messageContent: message_content,
        }
      });

      // Zarejestruj wirtualną rezerwację (Last minute slot)
      const targetDate = target_datetime ? new Date(target_datetime) : new Date();
      // Dodaj godzinę końca (+1h)
      const endDate = new Date(targetDate.getTime() + 60*60*1000);
      
      // Wybierzmy pierwszą usługę i pracownika (fallback)
      const service = await prisma.service.findFirst({ where: { tenantId: tenant.id } });
      const staff = await prisma.staffMember.findFirst({ where: { tenantId: tenant.id } });
      
      await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          serviceId: service ? service.id : '',
          staffId: staff ? staff.id : null,
          customerName: 'Last Minute Slot',
          customerPhone: 'SYSTEM',
          startTime: targetDate,
          endTime: endDate,
          status: 'last_minute_offer'
        }
      });

      let whereClause: any = { tenantId: tenant.id };
      if (audience_tags) {
        const tagsArray = audience_tags.split(',').map((t: string) => t.trim());
        const normalTags = tagsArray.filter(t => t.toLowerCase() !== '#uśpieni' && t.toLowerCase() !== 'uśpieni');
        
        if (normalTags.length > 0) {
           whereClause.tags = { hasSome: normalTags };
        }
        
        if (tagsArray.some(t => t.toLowerCase() === '#uśpieni' || t.toLowerCase() === 'uśpieni')) {
           const ninetyDaysAgo = new Date();
           ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
           whereClause.OR = [
             { lastVisitAt: { lt: ninetyDaysAgo } },
             { lastVisitAt: null, createdAt: { lt: ninetyDaysAgo } }
           ];
        }
      }

      const customers = await prisma.customer.findMany({ where: whereClause });

      for (const cust of customers) {
        if (!cust.phone) continue;
        await prisma.outboundQueue.create({
          data: {
            tenantId: tenant.id,
            targetPhone: cust.phone,
            channel: 'sms',
            payload: { customerId: cust.id, campaignId: campaign.id, text: message_content },
            status: 'pending',
            scheduledFor: new Date()
          }
        });
      }

      return res.json({ success: true, customersCount: customers.length, campaignId: campaign.id });
    }

    if (toolName === 'schedule_confirmation_flow') {
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
           text = `Dzwonisz do klienta by przypomnieć i poprosić o potwierdzenie rezerwacji, która odbędzie się jutro o godz. ${appt.startTime.toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit', timeZone:'Europe/Warsaw'})}.`;
         } else {
           text = `Przypomnienie: masz zaplanowaną rezerwację na jutro (godz. ${appt.startTime.toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit', timeZone:'Europe/Warsaw'})}). Odpisz TAK by potwierdzić, lub ANULUJ by zrezygnować.`;
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

      return res.json({ success: true, count: added });
    }

    res.status(400).json({ error: 'Nieznane narzędzie' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Tenant Settings API
app.get('/api/tenant', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(404).json({ error: 'Brak' });
    res.json(tenant);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});
app.post('/api/tenant/fcm-token', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(404).json({ error: 'Brak' });
    // W przyszłości można to zapisać do bazy
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Błąd' });
  }
});

app.put('/api/tenant', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(404).json({ error: 'Brak salonu' });
    
    let modeToSave = req.body.bookingMode ?? undefined;
    if (req.body.businessProfile && req.body.businessProfile !== 'facility') {
      modeToSave = 'hourly';
    }

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { 
        businessProfile: req.body.businessProfile, 
        aiVoice: req.body.aiVoice ?? undefined,
        bookingMode: modeToSave,
        botName: req.body.botName ?? undefined,
        toneOfVoice: req.body.toneOfVoice ?? undefined 
      }
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

// Staff API

// Staff API
app.get('/api/staff', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.json([]);
    const staff = await prisma.staffMember.findMany({
      where: { tenantId: tenant.id },
      include: { services: true }
    });
    res.json(staff);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.post('/api/staff', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak salonu' });
    
    const created = await prisma.staffMember.create({
      data: {
        tenantId: tenant.id,
        name: req.body.name,
        role: req.body.role,
        schedule: req.body.schedule || {},
        services: {
          create: (req.body.serviceIds || []).map((sId: string) => ({
            service: { connect: { id: sId } }
          }))
        }
      },
      include: { services: true }
    });
    res.json(created);
  } catch (err) { res.status(500).json({ error: 'Błąd tworzenia pracownika' }); }
});

app.put('/api/staff/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak salonu' });
    
    const item = await prisma.staffMember.findUnique({ where: { id: req.params.id } });
    if (!item || item.tenantId !== tenant.id) return res.status(403).json({ error: 'Odmowa dostępu' });

    await prisma.staffService.deleteMany({ where: { staffId: req.params.id } });
    const updated = await prisma.staffMember.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        role: req.body.role,
        schedule: req.body.schedule || {},
        services: {
          create: (req.body.serviceIds || []).map((sId: string) => ({
            service: { connect: { id: sId } }
          }))
        }
      },
      include: { services: true }
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Błąd aktualizacji pracownika' }); }
});

app.delete('/api/staff/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak salonu' });
    const item = await prisma.staffMember.findUnique({ where: { id: req.params.id } });
    if (!item || item.tenantId !== tenant.id) return res.status(403).json({ error: 'Odmowa dostępu' });

    await prisma.staffMember.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Błąd usuwania pracownika' }); }
});


// TimeOff API
app.get('/api/timeoff', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.json([]);
    const to = await prisma.timeOff.findMany({
      where: { tenantId: tenant.id },
      include: { staff: true }
    });
    res.json(to);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.post('/api/timeoff', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak salonu' });
    
    const created = await prisma.timeOff.create({
      data: {
        tenantId: tenant.id,
        staffId: req.body.staffId || null,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        reason: req.body.reason
      },
      include: { staff: true }
    });
    res.json(created);
  } catch (err) { res.status(500).json({ error: 'Błąd dodawania nieobecności' }); }
});

app.delete('/api/timeoff/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak salonu' });
    const item = await prisma.timeOff.findUnique({ where: { id: req.params.id } });
    if (!item || item.tenantId !== tenant.id) return res.status(403).json({ error: 'Odmowa dostępu' });

    await prisma.timeOff.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Błąd usuwania nieobecności' }); }
});


// Appointments API
app.get('/api/appointments', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.json([]);
    const apps = await prisma.appointment.findMany({
      where: { tenantId: tenant.id },
      include: { service: true, staff: true }
    });
    res.json(apps);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak salonu' });

    let serviceId = req.body.serviceId;
    if (!serviceId) {
      const defaultSvc = await prisma.service.findFirst({ where: { tenantId: tenant.id } });
      if (!defaultSvc) return res.status(400).json({ error: 'Najpierw dodaj usługę do cennika' });
      serviceId = defaultSvc.id;
    } else {
       const svc = await prisma.service.findUnique({ where: { id: serviceId }});
       if (!svc || svc.tenantId !== tenant.id) return res.status(400).json({ error: 'Usługa nie istnieje' });
    }

    
    let customerId = null;
    if (req.body.customerPhone) {
      let customer = await prisma.customer.findFirst({
        where: { tenantId: tenant.id, phone: req.body.customerPhone }
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: { tenantId: tenant.id, name: req.body.customerName || '', phone: req.body.customerPhone, tags: [] }
        });
      }
      customerId = customer.id;
      
      const newTags = new Set(customer.tags || []);
      const visitCount = await prisma.appointment.count({
        where: { tenantId: tenant.id, customerId: customer.id, status: 'confirmed' }
      });
      if (visitCount + 1 >= 3) newTags.add('#lojalny');
      if (visitCount + 1 >= 5) newTags.add('#vip');
      
      await prisma.customer.update({
        where: { id: customer.id },
        data: { lastVisitAt: new Date(req.body.startTime), tags: Array.from(newTags) }
      });
    }

    const created = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        serviceId: serviceId,
        staffId: req.body.staffId || null,
        customerId: customerId,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
        status: req.body.status || 'confirmed'
      }
    });
    res.json(created);
  } catch (err) { res.status(500).json({ error: 'Błąd tworzenia wizyty' }); }
});

app.put('/api/appointments/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak salonu' });
    const item = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!item || item.tenantId !== tenant.id) return res.status(403).json({ error: 'Odmowa dostępu' });

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        serviceId: req.body.serviceId,
        staffId: req.body.staffId || null,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
        status: req.body.status
      },
      include: { service: true, staff: true }
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Błąd edycji wizyty' }); }
});

app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak salonu' });
    const item = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!item || item.tenantId !== tenant.id) return res.status(403).json({ error: 'Odmowa dostępu' });

    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Błąd usuwania wizyty' }); }
});


// Services API
app.get('/api/services', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.json([]);
    const services = await prisma.service.findMany({ where: { tenantId: tenant.id } });
    res.json(services);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.post('/api/services', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'No tenant' });
    
    const created = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: req.body.name,
        price: Number(req.body.price),
        durationMinutes: Number(req.body.durationMinutes),
        description: req.body.description || ''
      }
    });
    res.json(created);
  } catch (err) { res.status(500).json({ error: 'Błąd tworzenia' }); }
});

app.put('/api/services/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'No tenant' });
    const item = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!item || item.tenantId !== tenant.id) return res.status(403).json({ error: 'Odmowa dostępu' });

    const updated = await prisma.service.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        price: Number(req.body.price),
        durationMinutes: Number(req.body.durationMinutes),
        description: req.body.description || ''
      }
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Błąd edycji' }); }
});

app.delete('/api/services/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'No tenant' });
    const item = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!item || item.tenantId !== tenant.id) return res.status(403).json({ error: 'Odmowa dostępu' });

    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Błąd usuwania' }); }
});



// CRM Customers API
app.get('/api/customers', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.json([]);
    const customers = await prisma.customer.findMany({ 
      where: { tenantId: tenant.id },
      orderBy: { lastVisitAt: 'desc' }
    });
    res.json(customers);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.post('/api/customers', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak' });
    const created = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: req.body.name,
        phone: req.body.phone,
        tags: req.body.tags || [],
        notes: req.body.notes || ''
      }
    });
    res.json(created);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak' });
    const item = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!item || item.tenantId !== tenant.id) return res.status(403).json({ error: 'Odmowa' });
    
    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        phone: req.body.phone,
        tags: req.body.tags || [],
        notes: req.body.notes || ''
      }
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak' });
    const item = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!item || item.tenantId !== tenant.id) return res.status(403).json({ error: 'Odmowa' });
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});


// FAQ API
app.get('/api/faq', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.json([]);
    const faqs = await prisma.faqEntry.findMany({ where: { tenantId: tenant.id } });
    res.json(faqs);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.post('/api/faq', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'No tenant' });
    
    const created = await prisma.faqEntry.create({
      data: {
        tenantId: tenant.id,
        question: req.body.question,
        answer: req.body.answer
      }
    });
    res.json(created);
  } catch (err) { res.status(500).json({ error: 'Błąd zapisu' }); }
});

app.put('/api/faq/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'No tenant' });
    const item = await prisma.faqEntry.findUnique({ where: { id: req.params.id } });
    if (!item || item.tenantId !== tenant.id) return res.status(403).json({ error: 'Odmowa dostępu' });
    
    const updated = await prisma.faqEntry.update({
      where: { id: req.params.id },
      data: {
        question: req.body.question,
        answer: req.body.answer
      }
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Błąd edycji' }); }
});

app.delete('/api/faq/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'No tenant' });
    const item = await prisma.faqEntry.findUnique({ where: { id: req.params.id } });
    if (!item || item.tenantId !== tenant.id) return res.status(403).json({ error: 'Odmowa dostępu' });

    await prisma.faqEntry.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Błąd usuwania' }); }
});



// --- API dla Autoryzacji i Subskrypcji ---

app.post('/api/tenants/init', async (req, res) => {
  // Ten endpoint wywoła się z frontendu zaraz po rejestracji przez Supabase Auth.
  const { tenantId, name, phoneNumber } = req.body;
  if (!tenantId) return res.status(400).json({ error: 'Brak tenantId z Supabase' });

  try {
    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (existing) return res.json(existing);

    const tenant = await prisma.tenant.create({
      data: {
        id: tenantId, // Używamy ID z Supabase
        name: name || 'Nowy Salon',
        phoneNumber: phoneNumber || 'Brak',
        subscription: {
          create: {
            planName: 'starter',
            minutesIncluded: 100,
            minutesUsed: 0,
            status: 'trialing'
          }
        }
      }
    });
    res.json(tenant);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { stripeController } from './controllers/StripeController';

app.post('/api/stripe/create-checkout-session', (req, res) => stripeController.createCheckoutSession(req, res));
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => stripeController.webhook(req, res));

// Endpoint na potrzeby deweloperskie / mockowania płatności (Faza 8)
app.post('/api/stripe/bypass', async (req, res) => {
  try {
    let { tenantId } = req.body;
    
    if (!tenantId || tenantId === '00000000-0000-0000-0000-000000000000') {
      const defaultTenant = await prisma.tenant.findFirst();
      if (!defaultTenant) return res.status(400).json({ error: 'Brak salonu w bazie' });
      tenantId = defaultTenant.id;
    }

    await prisma.subscription.update({
      where: { tenantId },
      data: {
        planName: 'pro',
        status: 'active',
        minutesIncluded: 1000
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Bypass error:', err);
    res.status(500).json({ error: 'Błąd aktywacji PRO' });
  }
});

app.post('/api/knowledge/extract', async (req, res) => {
  let { rawText, fileData, mimeType, tenantId } = req.body;
  
  if (!rawText && !fileData) {
    return res.status(400).json({ error: 'Należy dostarczyć tekst (rawText) lub plik (fileData)' });
  }

  try {
    if (!tenantId || tenantId === '00000000-0000-0000-0000-000000000000') {
      const defaultTenant = await prisma.tenant.findFirst();
      if (!defaultTenant) {
        return res.status(400).json({ error: 'Brak jakiegokolwiek salonu w bazie. Uruchom seed.' });
      }
      tenantId = defaultTenant.id;
    }

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId }
    });

    // Zwiększamy licznik użyć AI (zawsze)
    if (subscription) {
      await prisma.subscription.update({
        where: { tenantId },
        data: { aiGenerationsUsed: { increment: 1 } }
      });
    }

    const result = await knowledgeService.generateStructuredKnowledge(rawText, fileData, mimeType);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/knowledge/save', async (req, res) => {
  let { services, faq } = req.body;
  
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak jakiegokolwiek salonu w bazie. Uruchom seed.' });
    const tenantId = tenant.id;

    // Remove old knowledge before saving new one (to prevent duplicates when clicking "Zapisz" again)
    // We no longer delete services or FAQ here to prevent wiping manually entered data.
      // If the user clicks "Zapisz" multiple times, they might get duplicates, but that's better than deleting manual data.

    const transactions: any[] = [];
    
    // Zapisujemy usługi
    if (services && services.length > 0) {
      const servicesData = services.map((s: any) => ({
        tenantId,
        name: s.name,
        price: parseFloat(s.price) || 0,
        durationMinutes: parseInt(s.durationMinutes) || 30,
        description: s.description || ''
      }));
      transactions.push(prisma.service.createMany({ data: servicesData }));
    }

    // Zapisujemy FAQ
    if (faq && faq.length > 0) {
      const faqData = faq.map((f: any) => ({
        tenantId,
        question: f.question,
        answer: f.answer
      }));
      transactions.push(prisma.faqEntry.createMany({ data: faqData }));
    }

    if (transactions.length > 0) {
      await prisma.$transaction(transactions);
    }
    
    res.json({ success: true, message: 'Dane zapisane pomyślnie' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint kontrolny health check (wymagany np. przez Google Cloud Run)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});


// --- AUTH ENDPOINTS ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phoneNumber, pinCode } = req.body;
    if (!name || !phoneNumber || !pinCode) {
      return res.status(400).json({ error: 'Brakujące dane (nazwa, telefon, PIN)' });
    }
    const existing = await prisma.tenant.findUnique({ where: { phoneNumber } });
    if (existing) {
      return res.status(400).json({ error: 'Konto dla tego numeru telefonu już istnieje.' });
    }
    const tenant = await prisma.tenant.create({
      data: { name, phoneNumber, pinCode, termsAcceptedAt: new Date() }
    });
    res.json({ tenantId: tenant.id, message: 'Zarejestrowano pomyślnie' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd podczas rejestracji' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { phoneNumber, pinCode } = req.body;
    if (!phoneNumber || !pinCode) {
      return res.status(400).json({ error: 'Podaj numer telefonu i PIN' });
    }
    const tenant = await prisma.tenant.findUnique({ where: { phoneNumber } });
    if (!tenant) {
      return res.status(400).json({ error: 'Nie znaleziono konta.' });
    }
    if (tenant.pinCode !== pinCode) {
      return res.status(401).json({ error: 'Nieprawidłowy PIN.' });
    }
    res.json({ tenantId: tenant.id, message: 'Zalogowano pomyślnie' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd podczas logowania' });
  }
});

app.post('/api/tenant/wipe', async (req, res) => {
  try {
    const tid = (req as any).tenantId || req.body?.tenantId;
      if (!tid) return res.status(404).json({ error: 'Brak' });
      const tenant = await prisma.tenant.findUnique({ where: { id: tid } });
    if (!tenant) return res.status(400).json({ error: 'Brak tenanta' });
    
    await prisma.tenant.delete({ where: { id: tenant.id } });
    res.json({ success: true, message: 'Dane usunięto bezpowrotnie.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd podczas kasowania danych' });
  }
});

// --- SUBSCRIPTION ENDPOINTS ---
app.get('/api/subscription', async (req, res) => {
    try {
      const tid = (req as any).tenantId || req.query?.tenantId;
      if (!tid) return res.json({ status: 'none' });
      const tenant = await prisma.tenant.findUnique({ where: { id: tid } });
      if (!tenant) return res.json({ status: 'none' });
      const sub = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
      res.json(sub || { status: 'none' });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscription/pause', async (req, res) => {
  try {
    const tid = (req as any).tenantId || req.body?.tenantId;
      if (!tid) return res.status(404).json({ error: 'Brak' });
      const tenant = await prisma.tenant.findUnique({ where: { id: tid } });
    if (!tenant) return res.status(404).json({ error: 'Brak' });
    const pausedUntil = new Date();
    pausedUntil.setDate(pausedUntil.getDate() + 30);
    const sub = await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { status: 'paused', pausedAt: new Date(), pausedUntil }
    });
    res.json(sub);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscription/resume', async (req, res) => {
  try {
    const tid = (req as any).tenantId || req.body?.tenantId;
      if (!tid) return res.status(404).json({ error: 'Brak' });
      const tenant = await prisma.tenant.findUnique({ where: { id: tid } });
    if (!tenant) return res.status(404).json({ error: 'Brak' });
    const sub = await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { status: 'active', pausedAt: null, pausedUntil: null }
    });
    res.json(sub);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscription/cancel', async (req, res) => {
  try {
    const tid = (req as any).tenantId || req.body?.tenantId;
      if (!tid) return res.status(404).json({ error: 'Brak' });
      const tenant = await prisma.tenant.findUnique({ where: { id: tid } });
    if (!tenant) return res.status(404).json({ error: 'Brak' });
    const sub = await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { status: 'canceled', canceledAt: new Date() }
    });
    res.json(sub);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscription/change-plan', async (req, res) => {
  try {
    const tid = (req as any).tenantId || req.body?.tenantId;
      if (!tid) return res.status(404).json({ error: 'Brak' });
      const tenant = await prisma.tenant.findUnique({ where: { id: tid } });
    if (!tenant) return res.status(404).json({ error: 'Brak' });
    const sub = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
    if (!sub) return res.status(404).json({ error: 'Brak sub' });

    let newPlanName = sub.planName === 'standard' ? 'premium' : 'standard';
    let newMinutesIncluded = newPlanName === 'premium' ? 300 : 100;

    const updatedSub = await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { planName: newPlanName, minutesIncluded: newMinutesIncluded }
    });
    res.json(updatedSub);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tenant/provision-number', async (req, res) => {
  try {
    const tid = (req as any).tenantId || req.body?.tenantId;
      if (!tid) return res.status(404).json({ error: 'Brak' });
      const tenant = await prisma.tenant.findUnique({ where: { id: tid } });
    if (!tenant) return res.status(404).json({ error: 'Nie znaleziono' });

    if (!tenant.termsAcceptedAt) {
      return res.status(403).json({ error: 'Brak akceptacji regulaminu B2B' });
    }

    const fakeNumber = "+48459568507";
    
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { assignedPhoneNumber: fakeNumber }
    });

    res.json({ success: true, number: fakeNumber });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { app };

app.post("/api/twilio-incoming", (req, res) => {
  const host = req.headers.host;
  let callerPhone = req.body.From || 'unknown';
  let calledNumber = req.body.To || 'unknown';
  
  if (callerPhone.includes('sip:')) {
    const match = callerPhone.match(/sip:(.+)@/);
    if (match && match[1]) {
      callerPhone = match[1];
    } else {
      callerPhone = 'unknown';
    }
  }
  if (calledNumber.includes('sip:')) {
    const match = calledNumber.match(/sip:(.+)@/);
    if (match && match[1]) {
      calledNumber = match[1];
    } else {
      calledNumber = 'unknown';
    }
  }
  
  // Wykrywanie czy to jest Zadarma Callback (Outbound) - szukamy obu numerów w cache (Twilio może podać numer klienta w From lub To zależnie od konfiguracji pbx)
  let outboundTaskId = VoiceOutboundService.getTaskIdByPhone(callerPhone);
  if (!outboundTaskId) {
    outboundTaskId = VoiceOutboundService.getTaskIdByPhone(calledNumber);
  }

  // W TwiML dodajemy opcjonalny parametr outboundTaskId
  const outboundParam = outboundTaskId ? `<Parameter name="outboundTaskId" value="${outboundTaskId}" />` : '';

  res.type("text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://${host}/api/twilio-voice"><Parameter name="callerPhone" value="${callerPhone}" /><Parameter name="dialedNumber" value="${calledNumber}" />${outboundParam}</Stream></Connect></Response>`);
});

app.get("/api/zadarma-sms", (req, res) => {
  if (req.query.zd_echo) {
    return res.send(req.query.zd_echo);
  }
  res.send("OK");
});

app.post("/api/zadarma-sms", async (req, res) => {
    console.log("📨 [Zadarma SMS Webhook] Otrzymano żądanie:", req.body);
    
    let callerPhone = "";
    let rawBody = "";

    try {
      if (req.body.result && typeof req.body.result === 'string') {
        const resultObj = JSON.parse(req.body.result);
        callerPhone = resultObj.caller_id || "";
        rawBody = resultObj.text || "";
      } else {
        callerPhone = req.body.caller_id || req.body.From || "";
        rawBody = req.body.message || req.body.text || req.body.Body || "";
      }
    } catch (e) {
      console.error("❌ Błąd parsowania payloadu Zadarmy:", e);
    }

    if (callerPhone && !callerPhone.startsWith('+')) {
      callerPhone = '+' + callerPhone;
    }

    const bodyText = rawBody.trim().toUpperCase();

    
    if ((bodyText === "TAK" || bodyText === "POTWIERDZAM") && callerPhone) {
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
            sms.SMSService.sendSMS(callerPhone, `Dziękujemy, Twoja wizyta została pomyślnie potwierdzona!`).catch(console.error);
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
            sms.SMSService.sendSMS(callerPhone, `Zarejestrowano pomyślnie. Czekamy na Ciebie!`).catch(console.error);
          });
          return res.send("OK");
        } else {
          // Brak ofert last minute (zostały wykupione lub brak)
          // Jeśli wiemy, że odpowiada na ofertę, wyślij odrzucenie
          import('./services/sms/SMSService').then(sms => {
            sms.SMSService.sendSMS(callerPhone, `Przepraszamy, ale ten termin został już przed chwilą zarezerwowany. Zapraszamy do rezerwacji innych wolnych dat!`).catch(console.error);
          });
          return res.send("OK");
        }
        
      } catch (err) {}
    }

    if (bodyText.startsWith("ANULUJ") && callerPhone) {
      try {
        const upcomingList = await prisma.appointment.findMany({
          where: { 
            customerPhone: callerPhone, 
            status: 'confirmed', 
            startTime: { gt: new Date() } 
          },
          orderBy: { startTime: 'asc' }
        });

        if (upcomingList.length === 0) {
          return res.send("OK");
        }

        if (upcomingList.length === 1) {
          const upcoming = upcomingList[0];
          await prisma.appointment.delete({ where: { id: upcoming.id } });
          import('./services/sms/SMSService').then(sms => {
            const timeStr = upcoming.startTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
            sms.SMSService.sendSMS(callerPhone, `Twoja rezerwacja na godz. ${timeStr} zostala pomyslnie anulowana. Dziekujemy!`).catch(console.error);
          });
          return res.send("OK");
        }

        const msgTokens = bodyText.replace('ANULUJ', '').trim().split(/\s+/);
        let match = null;

        // 1. Spróbuj dopasować po indeksie (np. "ANULUJ 1")
        if (msgTokens.length === 1 && /^\d$/.test(msgTokens[0])) {
          const idx = parseInt(msgTokens[0], 10) - 1;
          if (idx >= 0 && idx < upcomingList.length) {
            match = upcomingList[idx];
          }
        }

        // 2. Spróbuj dopasować po dokładnej dacie i godzinie (np. "24.08 12:30" lub "24.08.12:30")
        if (!match) {
          const textToMatch = msgTokens.join('').replace(/[^\d]/g, ''); // "24081230"
          
          if (textToMatch.length >= 8) {
             const matchByDateTime = upcomingList.find(a => {
               const dateStr = a.startTime.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Warsaw' }).replace(/[^\d]/g, '');
               const timeStr = a.startTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }).replace(/[^\d]/g, '');
               return (dateStr + timeStr) === textToMatch.substring(0, 8);
             });
             if (matchByDateTime) match = matchByDateTime;
          }
          
          // 3. Dopasowanie po samej godzinie (pierwsza z brzegu)
          if (!match) {
             const timeMatch = bodyText.match(/(\d{1,2})[:.]?(\d{2})/);
             if (timeMatch) {
               const hour = parseInt(timeMatch[1], 10);
               const minute = parseInt(timeMatch[2], 10);
               const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
               match = upcomingList.find(a => {
                 const timeStr = a.startTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
                 return timeStr === formattedTime;
               });
             }
          }
        }

        if (match) {
          await prisma.appointment.delete({ where: { id: match.id } });
          const dateStr = match.startTime.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Warsaw' });
          const timeStr = match.startTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
          import('./services/sms/SMSService').then(sms => {
            sms.SMSService.sendSMS(callerPhone, `Rezerwacja z dnia ${dateStr} na godz. ${timeStr} zostala anulowana.`).catch(console.error);
          });
          return res.send("OK");
        }

        // Nie podano poprawnej godziny lub indeksu
        const msgList = upcomingList.map((a, i) => {
          const dateStr = a.startTime.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Warsaw' });
          const timeStr = a.startTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
          return `${i+1}) ${dateStr} ${timeStr}`;
        }).join(", ");

        import('./services/sms/SMSService').then(sms => {
          sms.SMSService.sendSMS(callerPhone, `Masz kilka rezerwacji: ${msgList}. Odpisz np. 'ANULUJ 1' aby usunac pierwsza, lub 'ANULUJ 2' aby usunac druga.`).catch(console.error);
        });

      } catch (err) {
        console.error("❌ [Zadarma SMS Webhook] Błąd bazy danych:", err);
      }
    }

    res.send("OK");
  });
