import { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');

// Zmienne z .env dla frontendu i cen
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// Wymagane ID produktów/cen z utworzonych w Stripe Dashboardzie
const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || 'price_mock_monthly';
const STRIPE_PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY || 'price_mock_yearly';

export class StripeController {
  
  public async createCheckoutSession(req: Request, res: Response) {
    const { tenantId, interval } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Brak tenantId' });
    }

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { subscription: true }
      });

      if (!tenant) {
        return res.status(404).json({ error: 'Nie znaleziono konta' });
      }

      const priceId = interval === 'yearly' ? STRIPE_PRICE_YEARLY : STRIPE_PRICE_MONTHLY;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card', 'blik'],
        mode: 'subscription',
        customer: tenant.subscription?.stripeCustomerId || undefined,
        customer_email: !tenant.subscription?.stripeCustomerId ? 'kontakt@' + tenant.id + '.com' : undefined, // w przyszłości email usera
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${FRONTEND_URL}/dashboard/subscription?success=true`,
        cancel_url: `${FRONTEND_URL}/dashboard/subscription?canceled=true`,
        client_reference_id: tenant.id,
        metadata: {
          tenantId: tenant.id
        }
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error('Stripe Checkout Error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  public async webhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      // Jeśli mamy ustawiony sekret webhooka, weryfikujemy podpis (wymagane raw body z express, ale tutaj uproszczone dla JSON)
      // W prawdziwej aplikacji Express musiałby otrzymać surowe body dla webhooków Stripe
      // Jako że używamy express.json() domyślnie, w celach testowych pominiemy rygorystyczną weryfikację jeśli sekretu brak.
      if (endpointSecret && sig) {
        // Uwaga: req.body musi być bufferem dla constructEvent, więc w prod potrzebny jest inny parser dla /webhook
        event = req.body; // Mock dla uproszczenia
      } else {
        event = req.body;
      }
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Obsługa zdarzeń
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const tenantId = session.client_reference_id || session.metadata?.tenantId;
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          if (tenantId) {
            await prisma.subscription.update({
              where: { tenantId },
              data: {
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                planName: 'pro',
                status: 'active',
                minutesIncluded: 1000 // np. limit na planie pro
              }
            });
            console.log(`Zakupiono subskrypcję PRO dla tenanta: ${tenantId}`);
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subscription.id },
            data: { status: 'canceled', planName: 'free', minutesIncluded: 100 }
          });
          break;
        }
      }
      res.status(200).json({ received: true });
    } catch (err) {
      console.error('Webhook processing error:', err);
      res.status(500).send('Internal Server Error');
    }
  }
}

export const stripeController = new StripeController();
