import express from 'express';
import cors from 'cors';
import { webhookController } from './controllers/WebhookController';

const app = express();

app.use(cors());
app.use(express.json());

// Endpoint używany przez asystenta głosowego (np. Vapi.ai) lub nasz frontendowy symulator
app.post('/api/chat', (req, res) => webhookController.handleIncomingChat(req, res));

// Endpoint specyficzny dla Custom LLM z Vapi.ai (wymaga standardu OpenAI)
app.post('/api/vapi-llm/chat/completions', (req, res) => webhookController.handleVapiCustomLLM(req, res));

// --- API dla PWA Dashboard ---
import { prisma } from './prisma';

app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({ 
      orderBy: { startTime: 'desc' },
      include: { service: true } 
    });
    res.json(appointments);
  } catch (err) { res.status(500).json({ error: 'Błąd' }); }
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

app.post('/api/stripe/create-checkout-session', async (req, res) => {
  // Mock środowiska testowego
  // W przyszłości tu użyjemy `stripe.checkout.sessions.create`
  res.json({ url: 'https://checkout.stripe.com/pay/cs_test_mock123' });
});

// Endpoint kontrolny health check (wymagany np. przez Google Cloud Run)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

export { app };
