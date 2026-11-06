import { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../prisma';

const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
const stripe = new Stripe(stripeKey);

export interface PlanPricingConfig {
  planName: 'personal' | 'personal_expert' | 'standard' | 'premium';
  displayName: string;
  amountGrosze: number; // Kwota w groszach (PLN)
  minutesIncluded: number;
  description: string;
  envPriceKey?: string;
}

export const PLAN_CATALOG: Record<string, PlanPricingConfig> = {
  personal: {
    planName: 'personal',
    displayName: 'Pakiet Osobisty EVA',
    amountGrosze: 14900, // 149,00 zł
    minutesIncluded: 100,
    description: 'Prywatna sekretarka AI Executive: 100 minut miesięcznie, kontakty VIP, kalendarz prywatny.',
    envPriceKey: process.env.STRIPE_PRICE_PERSONAL
  },
  personal_expert: {
    planName: 'personal_expert',
    displayName: 'Pakiet Osobisty Ekspert EVA',
    amountGrosze: 34900, // 349,00 zł
    minutesIncluded: 300,
    description: 'Dla ekspertów i kancelarii: 300 minut miesięcznie, kwalifikacja spraw, filtr rejonu, stenogramy rozmów AI.',
    envPriceKey: process.env.STRIPE_PRICE_PERSONAL_EXPERT
  },
  standard: {
    planName: 'standard',
    displayName: 'Pakiet Standard B2B EVA',
    amountGrosze: 19900, // 199,00 zł
    minutesIncluded: 100,
    description: 'Automatyczna recepcja dla firm i gabinetów: 100 minut miesięcznie, kalendarz wizyt i SMS.',
    envPriceKey: process.env.STRIPE_PRICE_STANDARD
  },
  premium: {
    planName: 'premium',
    displayName: 'Pakiet Premium B2B EVA',
    amountGrosze: 39900, // 399,00 zł
    minutesIncluded: 300,
    description: 'Dla salonów i klinik: 300 minut miesięcznie, Marketing AI, wielokanałowość (do 5 rozmów) i pełne stenogramy.',
    envPriceKey: process.env.STRIPE_PRICE_PREMIUM
  }
};

export interface TopupPackageConfig {
  id: 'topup_100' | 'topup_300';
  displayName: string;
  minutes: number;
  amountGrosze: number;
  description: string;
}

export const TOPUP_CATALOG: Record<string, TopupPackageConfig> = {
  topup_100: {
    id: 'topup_100',
    displayName: 'Doładowanie +100 nieprzepadających minut EVA',
    minutes: 100,
    amountGrosze: 7900, // 79,00 zł
    description: 'Pakiet 100 dodatkowych minut głosowych AI. Minuty nigdy nie przepadają na koniec miesiąca.'
  },
  topup_300: {
    id: 'topup_300',
    displayName: 'Doładowanie +300 nieprzepadających minut EVA (0,50 zł/min)',
    minutes: 300,
    amountGrosze: 14900, // 149,00 zł
    description: 'Pakiet 300 dodatkowych minut głosowych AI w cenie hurtowej. Minuty nigdy nie przepadają na koniec miesiąca.'
  }
};

export async function getOrCreatePlatformConfig() {
  let config = await prisma.platformConfig.findUnique({ where: { id: 'default' } });
  if (!config) {
    config = await prisma.platformConfig.create({
      data: {
        id: 'default',
        promoEnabled: true,
        promoMode: 'no_card',
        promoDays: 30,
        promoDefaultMinutes: 300
      }
    });
  }
  return config;
}

export class StripeController {

  private resolveFrontendOrigin(req: Request): string {
    const originHeader = req.headers.origin;
    if (originHeader && originHeader.startsWith('http')) {
      return originHeader.replace(/\/$/, '');
    }
    if (process.env.FRONTEND_URL) {
      return process.env.FRONTEND_URL.replace(/\/$/, '');
    }
    return 'https://beautyvoice-bff.web.app';
  }

  public async createCheckoutSession(req: Request, res: Response) {
    const {
      tenantId,
      planName = 'standard',
      checkoutType = 'subscription', // 'subscription' | 'prepaid_month' | 'topup_minutes'
      topupPackageId = 'topup_100'
    } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Brak identyfikatora konta (tenantId)' });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock') {
      return res.status(503).json({
        error: 'Bramka płatności Stripe oczekuje na aktywację klucza produkcyjnego (STRIPE_SECRET_KEY). Skontaktuj się z administratorem lub skorzystaj z darmowego okresu pilotażowego.'
      });
    }

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { subscription: true }
      });

      if (!tenant) {
        return res.status(404).json({ error: 'Nie znaleziono konta użytkownika' });
      }

      const frontendUrl = this.resolveFrontendOrigin(req);
      const customerEmail = tenant.contactEmail || tenant.betaContactEmail || undefined;
      const existingCustomerId = tenant.subscription?.stripeCustomerId || undefined;

      // 1. DOŁADOWANIE NIEPRZEPADAJĄCYCH MINUT (BLIK / Przelewy24 / Apple Pay / Karta)
      if (checkoutType === 'topup_minutes') {
        const pkg = TOPUP_CATALOG[topupPackageId] || TOPUP_CATALOG.topup_100;

        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card', 'blik', 'p24'],
          locale: 'pl',
          customer: existingCustomerId,
          customer_email: !existingCustomerId ? customerEmail : undefined,
          allow_promotion_codes: true,
          tax_id_collection: { enabled: true },
          ...(existingCustomerId ? { customer_update: { name: 'auto', address: 'auto' } } : {}),
          line_items: [
            {
              price_data: {
                currency: 'pln',
                unit_amount: pkg.amountGrosze,
                product_data: {
                  name: pkg.displayName,
                  description: pkg.description
                }
              },
              quantity: 1
            }
          ],
          success_url: `${frontendUrl}/dashboard/subscription?success=topup&minutes=${pkg.minutes}`,
          cancel_url: `${frontendUrl}/dashboard/subscription?canceled=true`,
          client_reference_id: tenant.id,
          metadata: {
            tenantId: tenant.id,
            checkoutType: 'topup_minutes',
            topupMinutes: String(pkg.minutes),
            topupPackageId: pkg.id
          }
        });

        return res.json({ url: session.url });
      }

      const plan = PLAN_CATALOG[planName] || PLAN_CATALOG.standard;

      // 2. OPŁATA ZA 1 MIESIĄC Z GÓRY BEZ PODPINANIA KARTY (Pre-Paid: BLIK / Przelewy24 / Karta)
      if (checkoutType === 'prepaid_month') {
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card', 'blik', 'p24'],
          locale: 'pl',
          customer: existingCustomerId,
          customer_email: !existingCustomerId ? customerEmail : undefined,
          allow_promotion_codes: true,
          tax_id_collection: { enabled: true },
          ...(existingCustomerId ? { customer_update: { name: 'auto', address: 'auto' } } : {}),
          line_items: [
            {
              price_data: {
                currency: 'pln',
                unit_amount: plan.amountGrosze,
                product_data: {
                  name: `${plan.displayName} — Dostęp na 30 dni (Pre-Paid)`,
                  description: `${plan.description} Płatność jednorazowa za 30 dni bez automatycznego odnawiania.`
                }
              },
              quantity: 1
            }
          ],
          success_url: `${frontendUrl}/dashboard/subscription?success=prepaid&plan=${plan.planName}`,
          cancel_url: `${frontendUrl}/dashboard/subscription?canceled=true`,
          client_reference_id: tenant.id,
          metadata: {
            tenantId: tenant.id,
            checkoutType: 'prepaid_month',
            planName: plan.planName,
            minutesIncluded: String(plan.minutesIncluded)
          }
        });

        return res.json({ url: session.url });
      }

      // 3. SUBSKRYPCJA CYKLICZNA (Apple Pay / Google Pay / Karta) + Opcjonalny Darmowy Okres z Promocji (Tryb A)
      const platformConfig = await getOrCreatePlatformConfig();
      const hasHadStripeSubBefore = Boolean(tenant.subscription?.stripeSubscriptionId);
      const applyStripeTrial =
        platformConfig.promoEnabled &&
        platformConfig.promoMode === 'stripe_trial' &&
        platformConfig.promoDays > 0 &&
        !hasHadStripeSubBefore;

      const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = plan.envPriceKey
        ? { price: plan.envPriceKey, quantity: 1 }
        : {
            price_data: {
              currency: 'pln',
              unit_amount: plan.amountGrosze,
              recurring: { interval: 'month' },
              product_data: {
                name: plan.displayName,
                description: plan.description
              }
            },
            quantity: 1
          };

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'], // Obsługuje Karty Visa/Mastercard, Apple Pay oraz Google Pay
        locale: 'pl',
        customer: existingCustomerId,
        customer_email: !existingCustomerId ? customerEmail : undefined,
        allow_promotion_codes: true,
        tax_id_collection: { enabled: true },
        ...(existingCustomerId ? { customer_update: { name: 'auto', address: 'auto' } } : {}),
        line_items: [lineItem],
        subscription_data: {
          ...(applyStripeTrial ? { trial_period_days: platformConfig.promoDays } : {}),
          metadata: {
            tenantId: tenant.id,
            planName: plan.planName,
            minutesIncluded: String(plan.minutesIncluded)
          }
        },
        success_url: `${frontendUrl}/dashboard/subscription?success=subscription&plan=${plan.planName}`,
        cancel_url: `${frontendUrl}/dashboard/subscription?canceled=true`,
        client_reference_id: tenant.id,
        metadata: {
          tenantId: tenant.id,
          checkoutType: 'subscription',
          planName: plan.planName,
          minutesIncluded: String(plan.minutesIncluded)
        }
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error('❌ [Stripe Checkout Error]:', err);
      return res.status(500).json({ error: err.message || 'Błąd tworzenia sesji płatności Stripe' });
    }
  }

  public async createPortalSession(req: Request, res: Response) {
    try {
      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: 'Brak identyfikatora konta (tenantId)' });
      }

      const sub = await prisma.subscription.findUnique({ where: { tenantId } });
      if (!sub?.stripeCustomerId) {
        return res.status(400).json({
          error: 'To konto nie posiada jeszcze podpiętego profilu płatnika w Stripe. Wybierz pakiet lub doładuj minuty, aby utworzyć profil rozliczeniowy.'
        });
      }

      const frontendUrl = this.resolveFrontendOrigin(req);
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${frontendUrl}/dashboard/subscription`
      });

      return res.json({ url: portalSession.url });
    } catch (err: any) {
      console.error('❌ [Stripe Portal Error]:', err);
      return res.status(500).json({ error: err.message || 'Nie udało się otworzyć portalu faktur Stripe' });
    }
  }

  private async syncTenantProfileWithPlan(tenantId: string, planName: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return;

    const isTargetPersonal = planName === 'personal' || planName === 'personal_expert';
    const updateData: any = {};

    if (isTargetPersonal && tenant.businessProfile !== 'personal') {
      updateData.businessProfile = 'personal';
      updateData.name = tenant.ownerName || tenant.name;
    } else if (!isTargetPersonal && tenant.businessProfile === 'personal') {
      updateData.businessProfile = 'solo';
      updateData.name = tenant.companyName || tenant.name;
    }

    if (planName === 'personal') updateData.betaNotes = '[Pakiet Osobisty]';
    else if (planName === 'personal_expert') updateData.betaNotes = '[Pakiet Osobisty Ekspert]';
    else if (planName === 'standard') updateData.betaNotes = '[Pakiet Standard B2B]';
    else if (planName === 'premium') updateData.betaNotes = '[Pakiet Premium B2B]';

    if (Object.keys(updateData).length > 0) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: updateData
      });
    }
  }

  public async webhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string | undefined;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: any;

    try {
      const rawBody = (req as any).rawBody || req.body;
      if (endpointSecret && sig && Buffer.isBuffer(rawBody)) {
        event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
      } else {
        event = req.body;
      }
    } catch (err: any) {
      console.error('⚠️ [Stripe Webhook Signature Error]:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const tenantId = session.client_reference_id || session.metadata?.tenantId;
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
          const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
          const checkoutType = session.metadata?.checkoutType || 'subscription';

          if (!tenantId) break;

          // 1. Zakup paczki nieprzepadających minut (BLIK / Przelewy24 / Karta)
          if (checkoutType === 'topup_minutes') {
            const addedMinutes = parseInt(session.metadata?.topupMinutes || '100', 10);
            await prisma.subscription.upsert({
              where: { tenantId },
              create: {
                tenantId,
                stripeCustomerId: customerId || null,
                planName: 'standard',
                status: 'active',
                minutesIncluded: 100,
                minutesUsed: 0,
                bonusMinutes: addedMinutes
              },
              update: {
                ...(customerId ? { stripeCustomerId: customerId } : {}),
                bonusMinutes: { increment: addedMinutes }
              }
            });
            console.log(`✅ [Stripe Webhook] Doładowano +${addedMinutes} nieprzepadających minut (bonusMinutes) dla tenanta: ${tenantId}`);
            break;
          }

          const planName = session.metadata?.planName || 'standard';
          const planCfg = PLAN_CATALOG[planName] || PLAN_CATALOG.standard;
          const minutesIncluded = parseInt(session.metadata?.minutesIncluded || String(planCfg.minutesIncluded), 10);

          // 2. Opłata Pre-Paid za 1 miesiąc z góry (BLIK / Przelewy24)
          if (checkoutType === 'prepaid_month') {
            const existingSub = await prisma.subscription.findUnique({ where: { tenantId } });
            const now = new Date();
            const baseDate = existingSub?.currentPeriodEnd && existingSub.currentPeriodEnd > now
              ? new Date(existingSub.currentPeriodEnd)
              : now;
            const newPeriodEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

            await prisma.subscription.upsert({
              where: { tenantId },
              create: {
                tenantId,
                stripeCustomerId: customerId || null,
                planName: planCfg.planName,
                status: 'active',
                minutesIncluded,
                minutesUsed: 0,
                bonusMinutes: 0,
                currentPeriodEnd: newPeriodEnd,
                expiryWarningSent: false
              },
              update: {
                ...(customerId ? { stripeCustomerId: customerId } : {}),
                planName: planCfg.planName,
                status: 'active',
                minutesIncluded,
                minutesUsed: 0, // Nowy miesiąc zeruje zużycie miesięczne, ale zachowuje bonusMinutes!
                currentPeriodEnd: newPeriodEnd,
                expiryWarningSent: false,
                pausedAt: null,
                pausedUntil: null
              }
            });

            await this.syncTenantProfileWithPlan(tenantId, planCfg.planName);
            console.log(`✅ [Stripe Webhook] Opłacono 30 dni z góry (Pre-Paid BLIK/P24) planu ${planCfg.planName} dla tenanta: ${tenantId} do ${newPeriodEnd.toISOString()}`);
            break;
          }

          // 3. Subskrypcja cykliczna (lub start okresu próbnego 0 zł ze Stripe)
          const isTrialCheckout = session.payment_status === 'no_payment_required';
          const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await prisma.subscription.upsert({
            where: { tenantId },
            create: {
              tenantId,
              stripeCustomerId: customerId || null,
              stripeSubscriptionId: subscriptionId || null,
              planName: planCfg.planName,
              status: isTrialCheckout ? 'trialing' : 'active',
              minutesIncluded,
              minutesUsed: 0,
              bonusMinutes: 0,
              currentPeriodEnd: periodEnd,
              expiryWarningSent: false
            },
            update: {
              ...(customerId ? { stripeCustomerId: customerId } : {}),
              ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
              planName: planCfg.planName,
              status: isTrialCheckout ? 'trialing' : 'active',
              minutesIncluded,
              minutesUsed: 0, // Zerujemy zużycie miesięczne, bonusMinutes zostają nienaruszone!
              currentPeriodEnd: periodEnd,
              expiryWarningSent: false,
              pausedAt: null,
              pausedUntil: null
            }
          });

          await this.syncTenantProfileWithPlan(tenantId, planCfg.planName);
          console.log(`✅ [Stripe Webhook] Aktywowano subskrypcję ${planCfg.planName} (status: ${isTrialCheckout ? 'trialing' : 'active'}) dla tenanta: ${tenantId}`);
          break;
        }

        case 'invoice.paid': {
          const invoice = event.data.object;
          const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
          if (!subscriptionId) break;

          // Odnowienie miesięczne subskrypcji: zerujemy minutesUsed, ale NIE ruszamy bonusMinutes!
          const periodEndUnix = invoice.lines?.data?.[0]?.period?.end;
          const nextPeriodEnd = periodEndUnix
            ? new Date(periodEndUnix * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: {
              status: 'active',
              minutesUsed: 0,
              currentPeriodEnd: nextPeriodEnd,
              expiryWarningSent: false
            }
          });
          console.log(`🔄 [Stripe Webhook] Odnowiono cykl rozliczeniowy dla subskrypcji ${subscriptionId} (minutesUsed = 0, bonusMinutes zachowane)`);
          break;
        }

        case 'customer.subscription.updated': {
          const subObj = event.data.object;
          const periodEnd = subObj.current_period_end ? new Date(subObj.current_period_end * 1000) : undefined;
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subObj.id },
            data: {
              status: subObj.status === 'active' || subObj.status === 'trialing' ? subObj.status : subObj.status,
              ...(periodEnd ? { currentPeriodEnd: periodEnd } : {})
            }
          });
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              status: 'canceled',
              canceledAt: new Date()
            }
          });
          console.log(`🛑 [Stripe Webhook] Anulowano subskrypcję ${subscription.id}`);
          break;
        }
      }
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('❌ [Stripe Webhook Processing Error]:', err);
      return res.status(500).send('Internal Server Error');
    }
  }
}

export const stripeController = new StripeController();
