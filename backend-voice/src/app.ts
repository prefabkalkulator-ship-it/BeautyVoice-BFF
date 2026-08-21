import express from 'express';
import cors from 'cors';
import { webhookController } from './controllers/WebhookController';
import { knowledgeService } from './services/KnowledgeExtractorService';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Endpoint używany przez asystenta głosowego (np. Vapi.ai) lub nasz frontendowy symulator
app.post('/api/chat', (req, res) => webhookController.handleIncomingChat(req, res));

// Endpoint specyficzny dla Custom LLM z Vapi.ai (wymaga standardu OpenAI)
app.post('/api/vapi-llm/chat/completions', (req, res) => webhookController.handleVapiCustomLLM(req, res));

// --- API dla PWA Dashboard ---
import { prisma } from './prisma';

app.get('/api/fix-db', async (req, res) => {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Tenant" ADD COLUMN "aiVoice" TEXT DEFAULT \'Aoede\'');
    res.json({ok: true});
  } catch (err: any) {
    res.json({error: err.message});
  }
});

// Tenant Settings API
app.get('/api/tenant', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    res.json(tenant);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.put('/api/tenant', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.status(404).json({ error: 'Brak salonu' });
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { businessProfile: req.body.businessProfile, aiVoice: req.body.aiVoice ?? undefined }
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

// Staff API
app.get('/api/staff', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
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
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.status(400).json({ error: 'Brak salonu' });
    
    const staff = await prisma.staffMember.create({
      data: {
        tenantId: tenant.id,
        name: req.body.name,
        role: req.body.role || 'Pracownik',
        workingHours: req.body.workingHours || '08:00-20:00',
        isActive: req.body.isActive !== undefined ? req.body.isActive : true
      }
    });

    if (req.body.serviceIds && Array.isArray(req.body.serviceIds)) {
      await prisma.staffService.createMany({
        data: req.body.serviceIds.map((sid: string) => ({
          staffId: staff.id,
          serviceId: sid
        }))
      });
    }

    res.json(staff);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.put('/api/staff/:id', async (req, res) => {
  try {
    const dataToUpdate: any = {
      name: req.body.name,
      role: req.body.role,
      isActive: req.body.isActive
    };
    if (req.body.workingHours !== undefined) {
      dataToUpdate.workingHours = req.body.workingHours;
    }

    const staff = await prisma.staffMember.update({
      where: { id: req.params.id },
      data: dataToUpdate
    });

    if (req.body.serviceIds && Array.isArray(req.body.serviceIds)) {
      await prisma.staffService.deleteMany({ where: { staffId: req.params.id } });
      await prisma.staffService.createMany({
        data: req.body.serviceIds.map((sid: string) => ({
          staffId: staff.id,
          serviceId: sid
        }))
      });
    }
    res.json(staff);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.delete('/api/staff/:id', async (req, res) => {
  try {
    await prisma.staffMember.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({ 
      orderBy: { startTime: 'desc' },
      include: { service: true, staff: true } 
    });
    res.json(appointments);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.post('/api/appointments', async (req, res) => {
  try {
    // W uproszczeniu pobieramy pierwszego tenanta (mock)
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.status(400).json({ error: 'Brak salonu' });

    // Walidacja id usługi
    let serviceId = req.body.serviceId;
    if (!serviceId) {
      // Jeśli brak, bierzemy pierwszą usługę lub zwracamy błąd
      const defaultSvc = await prisma.service.findFirst({ where: { tenantId: tenant.id } });
      if (!defaultSvc) return res.status(400).json({ error: 'Najpierw dodaj usługę do cennika' });
      serviceId = defaultSvc.id;
    } else {
       const svc = await prisma.service.findUnique({ where: { id: serviceId }});
       if (!svc) return res.status(400).json({ error: 'Usługa nie istnieje' });
    }

    const created = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        serviceId: serviceId,
        staffId: req.body.staffId || null,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
        status: req.body.status || 'confirmed'
      },
      include: { service: true }
    });
    res.json(created);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Błąd tworzenia wizyty' }); }
});

app.put('/api/appointments/:id', async (req, res) => {
  try {
    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
        status: req.body.status,
        serviceId: req.body.serviceId,
        staffId: req.body.staffId || null
      },
      include: { service: true }
    });
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Błąd aktualizacji' }); }
});

app.delete('/api/appointments/:id', async (req, res) => {
  try {
    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Błąd usuwania' }); }
});

app.get('/api/services', async (req, res) => {
  try {
    const services = await prisma.service.findMany();
    res.json(services);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.get('/api/faq', async (req, res) => {
  try {
    const faqs = await prisma.faqEntry.findMany();
    res.json(faqs);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
});

app.post('/api/services', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
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
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.status(400).json({ error: 'No tenant' });
    
    const updated = await prisma.service.upsert({
      where: { id: req.params.id },
      update: {
        name: req.body.name,
        price: Number(req.body.price),
        durationMinutes: Number(req.body.durationMinutes),
        description: req.body.description || ''
      },
      create: {
        id: req.params.id,
        tenantId: tenant.id,
        name: req.body.name,
        price: Number(req.body.price),
        durationMinutes: Number(req.body.durationMinutes),
        description: req.body.description || ''
      }
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Błąd aktualizacji' }); }
});

app.delete('/api/services/:id', async (req, res) => {
  try {
    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Błąd usuwania' }); }
});

app.post('/api/faq', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) return res.status(400).json({ error: 'No tenant' });
    
    const created = await prisma.faqEntry.create({
      data: {
        tenantId: tenant.id,
        question: req.body.question,
        answer: req.body.answer,
        category: req.body.category
      }
    });
    res.json(created);
  } catch (err) { res.status(500).json({ error: 'Błąd tworzenia' }); }
});

app.put('/api/faq/:id', async (req, res) => {
  try {
    const updated = await prisma.faqEntry.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Błąd aktualizacji' }); }
});

app.delete('/api/faq/:id', async (req, res) => {
  try {
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
  let { services, faq, tenantId } = req.body;
  
  try {
    // Jeżeli dostaliśmy testowy tenantId z frontendu, szukamy prawdziwego tenanta w bazie
    if (!tenantId || tenantId === '00000000-0000-0000-0000-000000000000') {
      const defaultTenant = await prisma.tenant.findFirst();
      if (!defaultTenant) {
        return res.status(400).json({ error: 'Brak jakiegokolwiek salonu w bazie. Uruchom seed.' });
      }
      tenantId = defaultTenant.id;
    }

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

export { app };

app.post("/api/twilio-incoming", (req, res) => {
  const host = req.headers.host;
  let callerPhone = req.body.From || 'unknown';
  
  if (callerPhone.includes('@') || callerPhone.includes('sip:')) {
    callerPhone = 'unknown';
  }
  
  res.type("text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://${host}/api/twilio-voice"><Parameter name="callerPhone" value="${callerPhone}" /></Stream></Connect></Response>`);
});

app.post("/api/twilio-sms", async (req, res) => {
  const callerPhone = req.body.From;
  const bodyText = (req.body.Body || "").trim().toUpperCase();

  res.type("text/xml");

  if (bodyText === "ANULUJ" && callerPhone) {
    try {
      const upcoming = await prisma.appointment.findFirst({
        where: { customerPhone: callerPhone, status: 'confirmed', startTime: { gt: new Date() } },
        orderBy: { startTime: 'asc' }
      });

      if (upcoming) {
        await prisma.appointment.update({
          where: { id: upcoming.id },
          data: { status: 'cancelled' }
        });
        import('./services/sms/SMSService').then(sms => {
          sms.SMSService.sendSMS(callerPhone, "Twoja rezerwacja została pomyślnie anulowana. Dziękujemy za informację!").catch(console.error);
        });
        return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
      }
    } catch (err) {
      console.error("[Twilio SMS] Błąd:", err);
    }
  }

  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
});
