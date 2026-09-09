import { SMSService } from './services/sms/SMSService';
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
  const rawTid = req.headers?.['x-tenant-id'] || req.body?.tenantId || req.query?.tenantId || req.tenantId;
  const tid = (rawTid && rawTid !== 'null' && rawTid !== 'undefined' && rawTid !== '00000000-0000-0000-0000-000000000000') ? String(rawTid).trim() : null;

  if (tid) {
    try {
      const found = await prisma.tenant.findUnique({ where: { id: tid } });
      if (found) return found;
    } catch (_) {}
  }

  // 2. Try looking up by phone
  const rawPhone = req.headers?.['x-tenant-phone'] || req.body?.phoneNumber || req.body?.tenantPhone || req.query?.phoneNumber;
  if (rawPhone && rawPhone !== 'null' && rawPhone !== 'undefined') {
    try {
      const clean = String(rawPhone).replace(/[\s\-()]/g, '');
      const found = await prisma.tenant.findFirst({
        where: {
          OR: [
            { phoneNumber: String(rawPhone).trim() },
            { phoneNumber: clean },
            { phoneNumber: { contains: clean.length > 6 ? clean.slice(-9) : clean } }
          ]
        }
      });
      if (found) return found;
    } catch (_) {}
  }

  // 3. Fallback: non-DEMO tenant with an active subscription or newest non-DEMO tenant
  try {
    const activeWithSub = await prisma.tenant.findFirst({
      where: { 
        name: { not: 'DEMO' },
        subscription: { isNot: null }
      },
      orderBy: { createdAt: 'desc' }
    });
    if (activeWithSub) return activeWithSub;

    const nonDemo = await prisma.tenant.findFirst({
      where: { name: { not: 'DEMO' } },
      orderBy: { createdAt: 'desc' }
    });
    if (nonDemo) return nonDemo;
  } catch (_) {}

  // 4. Ultimate fallback: any tenant
  return await prisma.tenant.findFirst();
}

app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Endpoint używany przez asystenta głosowego (np. Vapi.ai) lub nasz frontendowy symulator
app.post('/api/chat', (req, res) => webhookController.handleIncomingChat(req, res));

// Endpoint specyficzny dla Custom LLM z Vapi.ai (wymaga standardu OpenAI)
app.post('/api/vapi-llm/chat/completions', (req, res) => webhookController.handleVapiCustomLLM(req, res));

// --- API dla PWA Dashboard ---
import { prisma } from './prisma';

import { adminAuthMiddleware } from './middleware/adminAuth';

app.get('/api/fix-db', adminAuthMiddleware, async (req, res) => {
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
        toneOfVoice: req.body.toneOfVoice ?? undefined,
        termsAcceptedAt: req.body.termsAcceptedAt ? new Date(req.body.termsAcceptedAt) : undefined,
        fcmTokens: req.body.fcmToken ? { push: req.body.fcmToken } : undefined,
        reviewLink: req.body.reviewLink ?? undefined,
        reviewLink1: req.body.reviewLink1 ?? undefined,
        reviewLink2: req.body.reviewLink2 ?? undefined,
        contactEmail: req.body.contactEmail !== undefined ? req.body.contactEmail : undefined,
        emailPublicForAi: req.body.emailPublicForAi !== undefined ? req.body.emailPublicForAi : undefined,
        profession: req.body.profession !== undefined ? req.body.profession : undefined,
        bioSummary: req.body.bioSummary !== undefined ? req.body.bioSummary : undefined,
        bufferMinutes: req.body.bufferMinutes !== undefined ? parseInt(req.body.bufferMinutes, 10) : undefined,
        ownerRequirePin: req.body.ownerRequirePin !== undefined ? Boolean(req.body.ownerRequirePin) : undefined,
        morningBriefingEnabled: req.body.morningBriefingEnabled !== undefined ? Boolean(req.body.morningBriefingEnabled) : undefined,
        morningBriefingHour: req.body.morningBriefingHour !== undefined ? parseInt(req.body.morningBriefingHour, 10) : undefined
      }
    });

    if (req.body.businessProfile) {
      import('./services/ModerationService').then(async mod => {
        const faqs = await prisma.faqEntry.findMany({ where: { tenantId: tenant.id } });
        mod.moderationService.moderateKnowledgeBase(tenant.id, req.body.businessProfile, faqs);
      });
    }

    res.json(updated);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
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
app.post('/api/stripe/bypass', adminAuthMiddleware, async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(400).json({ error: 'Brak salonu w bazie' });

    const planName = (req.body?.planName || 'premium').toLowerCase();
    const minutesIncluded = planName === 'standard' ? 100 : 300;

    const sub = await prisma.subscription.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        planName,
        status: 'active',
        minutesIncluded,
        minutesUsed: 0
      },
      update: {
        planName,
        status: 'active',
        minutesIncluded
      }
    });
    res.json({ success: true, subscription: sub });
  } catch (err: any) {
    console.error('Bypass error:', err);
    res.status(500).json({ error: 'Błąd aktywacji subskrypcji: ' + err.message });
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
      data: { name, phoneNumber, pinCode }
    });
    res.json({ tenantId: tenant.id, phoneNumber: tenant.phoneNumber, name: tenant.name, message: 'Zarejestrowano pomyślnie' });
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
    res.json({ tenantId: tenant.id, phoneNumber: tenant.phoneNumber, name: tenant.name, message: 'Zalogowano pomyślnie' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd podczas logowania' });
  }
});

// --- RESET KODU PIN PRZEZ SMS ---
const pinResetStore = new Map<string, { code: string; expiresAt: number; tenantId: string }>();

app.post('/api/auth/forgot-pin/send-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Podaj numer telefonu' });
    }
    const clean = phoneNumber.replace(/[\s\-()]/g, '');
    const variants = [phoneNumber, clean];
    if (!clean.startsWith('+')) variants.push('+' + clean);
    if (clean.startsWith('+48')) variants.push(clean.replace('+48', ''));
    else if (!clean.startsWith('+')) variants.push('+48' + clean);

    const tenant = await prisma.tenant.findFirst({
      where: { phoneNumber: { in: variants } }
    });
    if (!tenant) {
      return res.status(404).json({ error: 'Nie znaleziono konta dla podanego numeru telefonu.' });
    }

    // Rate Limiting ochrona przed spamem SMS
    const { RateLimiterService } = await import('./services/security/RateLimiterService');
    const clientIp = ((req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || req.socket.remoteAddress || '').trim();
    const rateCheck = RateLimiterService.checkSmsLimit(tenant.phoneNumber, clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.reason });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    pinResetStore.set(tenant.id, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      tenantId: tenant.id
    });

    console.log(`🔑 [PIN Reset] Wygenerowano kod dla ${tenant.name} (${tenant.phoneNumber}): ${code}`);
    await SMSService.sendSMS(
      tenant.phoneNumber,
      `Twój kod do zresetowania PIN w BeautyVoice to: ${code}. Kod jest ważny 10 minut.`
    );
    RateLimiterService.recordSmsSent(tenant.phoneNumber, clientIp);

    res.json({ success: true, message: 'Kod weryfikacyjny został wysłany SMS-em.' });
  } catch (err: any) {
    console.error('Error sending reset OTP:', err);
    res.status(500).json({ error: 'Błąd podczas wysyłania kodu SMS: ' + err.message });
  }
});

app.post('/api/auth/forgot-pin/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, code, newPin } = req.body;
    if (!phoneNumber || !code || !newPin) {
      return res.status(400).json({ error: 'Wymagany numer telefonu, kod SMS oraz nowy PIN.' });
    }
    if (newPin.length < 4) {
      return res.status(400).json({ error: 'Kod PIN musi mieć co najmniej 4 cyfry.' });
    }
    const clean = phoneNumber.replace(/[\s\-()]/g, '');
    const variants = [phoneNumber, clean];
    if (!clean.startsWith('+')) variants.push('+' + clean);
    if (clean.startsWith('+48')) variants.push(clean.replace('+48', ''));
    else if (!clean.startsWith('+')) variants.push('+48' + clean);

    const tenant = await prisma.tenant.findFirst({
      where: { phoneNumber: { in: variants } }
    });
    if (!tenant) {
      return res.status(404).json({ error: 'Nie znaleziono konta.' });
    }

    const session = pinResetStore.get(tenant.id);
    if (!session || session.code !== code.trim()) {
      return res.status(400).json({ error: 'Nieprawidłowy kod weryfikacyjny SMS.' });
    }
    if (Date.now() > session.expiresAt) {
      pinResetStore.delete(tenant.id);
      return res.status(400).json({ error: 'Kod weryfikacyjny wygasł. Poproś o nowy kod.' });
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { pinCode: newPin }
    });
    pinResetStore.delete(tenant.id);

    console.log(`✅ [PIN Reset] Pomyślnie zmieniono PIN dla tenanta ${tenant.name}`);
    res.json({ success: true, tenantId: tenant.id, message: 'Kod PIN został pomyślnie zaktualizowany.' });
  } catch (err: any) {
    console.error('Error verifying reset OTP:', err);
    res.status(500).json({ error: 'Błąd podczas zmiany PIN: ' + err.message });
  }
});

app.post('/api/tenant/wipe', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(404).json({ error: 'Brak tenanta' });

    // Weryfikacja PINu salonu lub potwierdzenia przed usunięciem (RODO)
    const { pinCode, confirmText } = req.body;
    if (tenant.pinCode) {
      if (!pinCode || String(pinCode).trim() !== tenant.pinCode) {
        return res.status(403).json({ error: 'Nieprawidłowy kod PIN. Wprowadź poprawny kod PIN, aby potwierdzić usunięcie konta.' });
      }
    } else {
      if (confirmText !== 'USUŃ' && req.body.confirm !== true) {
        return res.status(400).json({ error: 'Wymagane potwierdzenie wpisaniem słowa USUŃ.' });
      }
    }

    await prisma.tenant.delete({ where: { id: tenant.id } });
    res.json({ success: true, message: 'Dane usunięto bezpowrotnie zgodnie z art. 17 RODO.' });
  } catch (err: any) {
    console.error('[Tenant Wipe Error]', err);
    res.status(500).json({ error: err.message || 'Błąd podczas kasowania danych' });
  }
});

// --- SUBSCRIPTION ENDPOINTS ---
app.get('/api/subscription', async (req, res) => {
    try {
      const tenant = await getContextTenant(req);
      if (!tenant) return res.json({ status: 'none' });
      const sub = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
      res.json(sub || { status: 'none' });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscription/pause', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(404).json({ error: 'Brak tenanta' });
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
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(404).json({ error: 'Brak tenanta' });
    const sub = await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { status: 'active', pausedAt: null, pausedUntil: null }
    });
    res.json(sub);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscription/cancel', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(404).json({ error: 'Brak tenanta' });
    const sub = await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { status: 'canceled', canceledAt: new Date() }
    });
    res.json(sub);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscription/change-plan', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(404).json({ error: 'Nie znaleziono konta' });

    const targetPlan = req.body.targetPlan || req.body.planName;
    const sub = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });

    let newPlanName = targetPlan;
    if (!newPlanName) {
      if (sub?.planName === 'standard') newPlanName = 'premium';
      else if (sub?.planName === 'premium') newPlanName = 'personal';
      else newPlanName = 'standard';
    }

    let newMinutesIncluded = 100;
    if (newPlanName === 'premium') newMinutesIncluded = 300;
    else if (newPlanName === 'standard') newMinutesIncluded = 100;
    else if (newPlanName === 'personal') newMinutesIncluded = 100;

    const updatedSub = await prisma.subscription.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        planName: newPlanName,
        minutesIncluded: newMinutesIncluded,
        status: 'active'
      },
      update: {
        planName: newPlanName,
        minutesIncluded: newMinutesIncluded,
        status: 'active'
      }
    });

    if (newPlanName === 'personal' && tenant.businessProfile !== 'personal') {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { businessProfile: 'personal' }
      });
    } else if (newPlanName !== 'personal' && tenant.businessProfile === 'personal') {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { businessProfile: 'solo' }
      });
    }

    res.json({
      ...updatedSub,
      tenantId: tenant.id
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tenant/provision-number', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(404).json({ error: 'Nie znaleziono konta' });

    if (tenant.assignedPhoneNumber) {
      return res.json({ success: true, number: tenant.assignedPhoneNumber });
    }

    return res.status(400).json({ 
      error: 'Wirtualny numer telefonu nie został jeszcze przydzielony. Zgłoś wniosek pilotażowy w zakładce Subskrypcja, a administrator skonfiguruje numer dla Twojej firmy.' 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { app };

app.post("/api/twilio-incoming", async (req, res) => {
  const host = req.headers.host;
  let callerPhone = req.body.From || 'unknown';
  let calledNumber = req.body.To || 'unknown';
  
  if (callerPhone.includes('sip:')) {
    const match = callerPhone.match(/sip:(.+)@/);
    if (match && match[1]) callerPhone = match[1];
    else callerPhone = 'unknown';
  }
  if (calledNumber.includes('sip:')) {
    const match = calledNumber.match(/sip:(.+)@/);
    if (match && match[1]) calledNumber = match[1];
    else calledNumber = 'unknown';
  }

  // Weryfikacja czy salon docelowy nie jest zawieszony lub zapauzowany
  let normalizedDialed = calledNumber;
  if (normalizedDialed !== 'unknown' && !normalizedDialed.startsWith('+')) {
    normalizedDialed = '+' + normalizedDialed;
  }

  // 🔀 Opcjonalne przekierowanie deweloperskie (Dev Proxy)
  // Pozwala na bezpieczne testowanie na numerze deweloperskim bez dotykania konfiguracji Zadarma dla salonów produkcyjnych
  const devForwardUrl = process.env.DEV_FORWARD_URL;
  const devTestNumber = process.env.DEV_TEST_PHONE_NUMBER || '+48459568507';
  if (devForwardUrl && (normalizedDialed === devTestNumber || calledNumber === devTestNumber)) {
    console.log(`🔀 [Dev Proxy] Przekierowanie połączenia testowego (${normalizedDialed}) na serwer dev: ${devForwardUrl}`);
    const cleanHost = devForwardUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    res.type("text/xml");
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://${cleanHost}/api/twilio-voice"><Parameter name="callerPhone" value="${callerPhone}" /><Parameter name="dialedNumber" value="${calledNumber}" /></Stream></Connect><Hangup/></Response>`);
  }
  
  let tenant = await prisma.tenant.findFirst({
    where: { OR: [{ assignedPhoneNumber: normalizedDialed }, { phoneNumber: normalizedDialed }] },
    include: { subscription: true }
  });

  // Bezpieczny fallback: jeśli numer nie jest bezpośrednio powiązany z żadnym salonem, kieruj do DEMO
  if (!tenant) {
    tenant = await prisma.tenant.findFirst({
      where: { name: 'DEMO' },
      include: { subscription: true }
    });
  }

  res.type("text/xml");

  if (!tenant) {
    console.log(`⚠️ [Twilio Incoming] Odrzucono połączenie od ${callerPhone} do ${calledNumber}: Numer nie jest przypisany do żadnego aktywnego salonu.`);
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pl-PL">Wybrany numer nie jest obecnie przypisany do żadnego aktywnego salonu. Prosimy sprawdzić poprawność numeru.</Say><Hangup/></Response>`);
  }

  if (tenant.isSuspended || (tenant.subscription && (tenant.subscription.status === 'paused' || tenant.subscription.status === 'canceled'))) {
    console.log(`🚫 [Twilio Incoming] Odrzucono połączenie od ${callerPhone} do ${calledNumber}. Salon: ${tenant.name} jest zawieszony (isSuspended: ${tenant.isSuspended}, sub: ${tenant.subscription?.status})`);
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pl-PL">Przepraszamy, asystent głosowy jest obecnie niedostępny z przyczyn technicznych. Prosimy spróbować później.</Say><Hangup/></Response>`);
  }
  
  // Wykrywanie czy to jest Zadarma Callback (Outbound) - szukamy obu numerów w cache (Twilio może podać numer klienta w From lub To zależnie od konfiguracji pbx)
  let outboundTaskId = VoiceOutboundService.getTaskIdByPhone(callerPhone);
  if (!outboundTaskId) {
    outboundTaskId = VoiceOutboundService.getTaskIdByPhone(calledNumber);
  }

  const outboundParam = outboundTaskId ? `<Parameter name="outboundTaskId" value="${outboundTaskId}" />` : '';

  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://${host}/api/twilio-voice"><Parameter name="callerPhone" value="${callerPhone}" /><Parameter name="dialedNumber" value="${calledNumber}" />${outboundParam}</Stream></Connect><Hangup/></Response>`);
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
        const ten = await prisma.tenant.findFirst({ where: { OR: [ { appointments: { some: { customerPhone: callerPhone } } } ] }, include: { subscription: true } }); if (ten && (ten.isSuspended || (ten.subscription && (ten.subscription.status === 'paused' || ten.subscription.status === 'canceled')))) { console.log('[Zadarma] SMS zignorowany, konto zawieszone'); return res.send('OK'); }

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
        const ten = await prisma.tenant.findFirst({ where: { OR: [ { appointments: { some: { customerPhone: callerPhone } } } ] }, include: { subscription: true } }); if (ten && (ten.isSuspended || (ten.subscription && (ten.subscription.status === 'paused' || ten.subscription.status === 'canceled')))) { console.log('[Zadarma] SMS zignorowany, konto zawieszone'); return res.send('OK'); }

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

// ==========================================
// --- API DLA OSOBISTEGO ASYSTENTA AI ---
// ==========================================

// 1. VIP Contacts API
app.get('/api/vip-contacts', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Brak autoryzacji' });
    const vips = await prisma.vipContact.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(vips);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vip-contacts', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Brak autoryzacji' });

    let { phoneNumber, contactName, category, customNotes, allowPrioritySlots } = req.body;
    if (!phoneNumber || !contactName) {
      return res.status(400).json({ error: 'Numer telefonu i nazwa kontaktu są wymagane.' });
    }

    let cleaned = phoneNumber.replace(/[\s-()]/g, '');
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 9) cleaned = '+48' + cleaned;
      else cleaned = '+' + cleaned;
    }

    const vip = await prisma.vipContact.upsert({
      where: {
        tenantId_phoneNumber: {
          tenantId: tenant.id,
          phoneNumber: cleaned
        }
      },
      update: {
        contactName,
        category: category || 'VIP',
        customNotes: customNotes ?? null,
        allowPrioritySlots: allowPrioritySlots !== undefined ? Boolean(allowPrioritySlots) : true
      },
      create: {
        tenantId: tenant.id,
        phoneNumber: cleaned,
        contactName,
        category: category || 'VIP',
        customNotes: customNotes ?? null,
        allowPrioritySlots: allowPrioritySlots !== undefined ? Boolean(allowPrioritySlots) : true
      }
    });

    res.json(vip);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vip-contacts/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Brak autoryzacji' });

    const { id } = req.params;
    const { contactName, category, customNotes, allowPrioritySlots, phoneNumber } = req.body;

    let cleaned = phoneNumber ? phoneNumber.replace(/[\s-()]/g, '') : undefined;
    if (cleaned && !cleaned.startsWith('+')) {
      if (cleaned.length === 9) cleaned = '+48' + cleaned;
      else cleaned = '+' + cleaned;
    }

    const updated = await prisma.vipContact.updateMany({
      where: { id, tenantId: tenant.id },
      data: {
        contactName: contactName ?? undefined,
        phoneNumber: cleaned ?? undefined,
        category: category ?? undefined,
        customNotes: customNotes !== undefined ? customNotes : undefined,
        allowPrioritySlots: allowPrioritySlots !== undefined ? Boolean(allowPrioritySlots) : undefined
      }
    });

    res.json({ success: true, count: updated.count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vip-contacts/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Brak autoryzacji' });

    const { id } = req.params;
    await prisma.vipContact.deleteMany({
      where: { id, tenantId: tenant.id }
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Annual Events API (Rocznice, Urodziny, Podatki)
app.get('/api/annual-events', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Brak autoryzacji' });

    const events = await prisma.annualEvent.findMany({
      where: { tenantId: tenant.id },
      orderBy: [
        { month: 'asc' },
        { day: 'asc' }
      ]
    });
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/annual-events', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Brak autoryzacji' });

    const { title, month, day, category, reminderDaysAhead } = req.body;
    if (!title || !month || !day) {
      return res.status(400).json({ error: 'Tytuł, miesiąc i dzień są wymagane.' });
    }

    const event = await prisma.annualEvent.create({
      data: {
        tenantId: tenant.id,
        title,
        month: parseInt(month, 10),
        day: parseInt(day, 10),
        category: category || 'custom',
        reminderDaysAhead: reminderDaysAhead !== undefined ? parseInt(reminderDaysAhead, 10) : 1
      }
    });

    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/annual-events/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Brak autoryzacji' });

    const { id } = req.params;
    const { title, month, day, category, reminderDaysAhead } = req.body;

    const updated = await prisma.annualEvent.updateMany({
      where: { id, tenantId: tenant.id },
      data: {
        title: title ?? undefined,
        month: month !== undefined ? parseInt(month, 10) : undefined,
        day: day !== undefined ? parseInt(day, 10) : undefined,
        category: category ?? undefined,
        reminderDaysAhead: reminderDaysAhead !== undefined ? parseInt(reminderDaysAhead, 10) : undefined
      }
    });

    res.json({ success: true, count: updated.count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/annual-events/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Brak autoryzacji' });

    const { id } = req.params;
    await prisma.annualEvent.deleteMany({
      where: { id, tenantId: tenant.id }
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Call Logs & Messages API
app.get('/api/call-logs', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Brak autoryzacji' });

    const { onlyMessages, limit } = req.query;
    const whereClause: any = { tenantId: tenant.id };
    if (onlyMessages === 'true') {
      whereClause.OR = [
        { isMessageLeft: true },
        { summary: { not: null } }
      ];
    }

    const takeCount = limit ? parseInt(limit as string, 10) : 100;

    const logs = await prisma.callLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: takeCount
    });

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/call-logs/:id/processed', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Brak autoryzacji' });

    const { id } = req.params;
    const updated = await prisma.callLog.updateMany({
      where: { id, tenantId: tenant.id },
      data: { isProcessed: true }
    });

    res.json({ success: true, count: updated.count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/call-logs/:id', async (req, res) => {
  try {
    const tenant = await getContextTenant(req);
    if (!tenant) return res.status(401).json({ error: 'Brak autoryzacji' });

    const { id } = req.params;
    await prisma.callLog.deleteMany({
      where: { id, tenantId: tenant.id }
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- API dla Super-Administratora i Pilotażu Beta ---
import { adminController } from './controllers/AdminController';
import { betaController } from './controllers/BetaController';

// Trasy pilotażowe (Beta Onboarding)
app.post('/api/beta/apply', (req, res) => betaController.apply(req, res));
app.get('/api/beta/status', (req, res) => betaController.getStatus(req, res));

// Trasa logowania SuperAdmina (weryfikacja PINu 5742 z .env)
app.post('/api/admin/login', (req, res) => adminController.login(req, res));

// Trasy SuperAdmina (chronione przez adminAuthMiddleware)
app.get('/api/admin/tenants', adminAuthMiddleware, (req, res) => adminController.getTenants(req, res));
app.get('/api/admin/tenants/:id', adminAuthMiddleware, (req, res) => adminController.getTenantDetails(req, res));
app.post('/api/admin/tenants/:id/suspend', adminAuthMiddleware, (req, res) => adminController.suspendTenant(req, res));
app.post('/api/admin/tenants/:id/approve', adminAuthMiddleware, (req, res) => adminController.approveTenant(req, res));
app.post('/api/admin/tenants/:id/adjust-minutes', adminAuthMiddleware, (req, res) => adminController.adjustMinutes(req, res));
app.post('/api/admin/tenants/:id/sms', adminAuthMiddleware, (req, res) => adminController.sendSmsNotification(req, res));
app.post('/api/admin/tenants/:id/subscription/status', adminAuthMiddleware, (req, res) => adminController.setSubscriptionStatus(req, res));
app.post('/api/admin/fcm-token', adminAuthMiddleware, (req, res) => adminController.registerAdminDevice(req, res));
app.get('/api/admin/beta-applications', adminAuthMiddleware, (req, res) => adminController.getBetaApplications(req, res));
app.post('/api/admin/beta-applications/:id/approve', adminAuthMiddleware, (req, res) => adminController.approveBetaApplication(req, res));
app.delete('/api/admin/beta-applications/:id', adminAuthMiddleware, (req, res) => adminController.deleteBetaApplication(req, res));


