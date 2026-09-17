import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { createAdminToken } from '../middleware/adminAuth';
import { SMSService } from '../services/sms/SMSService';

const SUPERADMIN_SECRET = process.env.SUPERADMIN_SECRET || 'bv_sec_98f4a7c1b2e3d4f5a6b7c8d9e0f1a2b3';
const SUPERADMIN_PHONE = process.env.SUPERADMIN_PHONE || '+48531491626';

export class AdminController {

  /**
   * Krok 1 logowania: Weryfikacja PIN-u i wysyłka jednorazowego kodu SMS (2FA).
   */
  public async initiateLogin(req: Request, res: Response) {
    try {
      const { pin } = req.body;
      const expectedPin = process.env.SUPERADMIN_PIN || '5742';

      if (!pin || String(pin).trim() !== expectedPin) {
        return res.status(401).json({ error: 'Nieprawidłowy kod PIN administratora.' });
      }

      // Czyszczenie przeterminowanych wyzwań 2FA
      try {
        await prisma.adminChallenge.deleteMany({
          where: { expiresAt: { lt: new Date() } }
        });
      } catch (cleanErr) {
        console.warn('⚠️ [Admin 2FA] Błąd czyszczenia starych kodów:', cleanErr);
      }

      // Sprawdzenie cooldownu (min. 15 sekund od ostatniego żądania na ten numer)
      const recentChallenge = await prisma.adminChallenge.findFirst({
        where: {
          phone: SUPERADMIN_PHONE,
          createdAt: { gt: new Date(Date.now() - 15 * 1000) }
        }
      });
      if (recentChallenge) {
        return res.status(429).json({ 
          error: 'Kod SMS został wysłany przed chwilą. Odczekaj kilkanaście sekund przed ponowną próbą.' 
        });
      }

      // Generowanie 6-cyfrowego losowego kodu OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = crypto
        .createHash('sha256')
        .update(`${code}:${SUPERADMIN_SECRET}`)
        .digest('hex');

      const challengeId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minut

      await prisma.adminChallenge.create({
        data: {
          id: challengeId,
          codeHash,
          phone: SUPERADMIN_PHONE,
          expiresAt,
          attempts: 0
        }
      });

      // Wysłanie wiadomości SMS
      const smsMessage = `EVA SuperAdmin: Twój jednorazowy kod logowania to: ${code}. Kod jest ważny przez 5 minut.`;
      const smsSent = await SMSService.sendSMS(SUPERADMIN_PHONE, smsMessage);

      if (!smsSent) {
        console.error(`❌ [Admin 2FA] Nie udało się dostarczyć SMS z kodem do ${SUPERADMIN_PHONE}`);
        return res.status(500).json({ error: 'Błąd bramki SMS. Nie udało się wysłać kodu weryfikacyjnego na telefon.' });
      }

      const maskedPhone = '+48 531 *** 626';
      console.log(`📲 [Admin 2FA] Wysłano kod SMS 2FA na numer ${maskedPhone}, challengeId: ${challengeId}`);

      return res.status(200).json({
        success: true,
        step: '2FA_REQUIRED',
        challengeId,
        maskedPhone,
        expiresInSeconds: 300
      });
    } catch (e: any) {
      console.error('❌ [Admin 2FA] Błąd inicjacji logowania:', e);
      return res.status(500).json({ error: e.message || 'Wystąpił nieoczekiwany błąd logowania.' });
    }
  }

  /**
   * Krok 2 logowania: Weryfikacja kodu SMS i wydanie bezpiecznego tokenu sesji.
   */
  public async verify2FA(req: Request, res: Response) {
    try {
      const { challengeId, code } = req.body;

      if (!challengeId || !code) {
        return res.status(400).json({ error: 'Brak wymaganych parametrów (challengeId lub kod SMS).' });
      }

      const challenge = await prisma.adminChallenge.findUnique({
        where: { id: String(challengeId) }
      });

      if (!challenge) {
        return res.status(401).json({ error: 'Sesja autoryzacyjna wygasła lub jest nieprawidłowa. Rozpocznij logowanie ponownie.' });
      }

      if (new Date() > challenge.expiresAt) {
        await prisma.adminChallenge.delete({ where: { id: challengeId } }).catch(() => {});
        return res.status(401).json({ error: 'Kod weryfikacyjny wygasł (ważność 5 minut). Wygeneruj nowy kod.' });
      }

      if (challenge.attempts >= 3) {
        await prisma.adminChallenge.delete({ where: { id: challengeId } }).catch(() => {});
        return res.status(403).json({ error: 'Przekroczono maksymalną liczbę prób weryfikacji. Rozpocznij logowanie od nowa wprowadzając PIN.' });
      }

      const expectedHash = crypto
        .createHash('sha256')
        .update(`${String(code).trim()}:${SUPERADMIN_SECRET}`)
        .digest('hex');

      const isMatch = crypto.timingSafeEqual(
        Buffer.from(expectedHash, 'utf8'),
        Buffer.from(challenge.codeHash, 'utf8')
      );

      if (!isMatch) {
        const updated = await prisma.adminChallenge.update({
          where: { id: challengeId },
          data: { attempts: { increment: 1 } }
        });
        const remaining = 3 - updated.attempts;
        return res.status(401).json({ 
          error: `Nieprawidłowy kod weryfikacyjny SMS. Pozostało prób: ${remaining > 0 ? remaining : 0}.` 
        });
      }

      // Pomyślna weryfikacja 2FA - usunięcie wykorzystanego wyzwania
      await prisma.adminChallenge.delete({ where: { id: challengeId } }).catch(() => {});

      const token = createAdminToken();
      console.log('🛡️ [SuperAdmin 2FA] Pomyślne logowanie dwuetapowe administratora z numeru ' + challenge.phone);

      return res.status(200).json({
        success: true,
        token,
        expiresInDays: 7
      });
    } catch (e: any) {
      console.error('❌ [Admin 2FA] Błąd weryfikacji 2FA:', e);
      return res.status(500).json({ error: e.message || 'Błąd weryfikacji kodu 2FA.' });
    }
  }

  /**
   * Ponowna wysyłka kodu SMS (resend) z ochroną cooldownu.
   */
  public async resend2FA(req: Request, res: Response) {
    try {
      const { challengeId, pin } = req.body;
      const expectedPin = process.env.SUPERADMIN_PIN || '5742';

      if (!pin || String(pin).trim() !== expectedPin) {
        return res.status(401).json({ error: 'Nieprawidłowy kod PIN administratora.' });
      }

      if (!challengeId) {
        return res.status(400).json({ error: 'Brak identyfikatora sesji.' });
      }

      const challenge = await prisma.adminChallenge.findUnique({
        where: { id: String(challengeId) }
      });

      if (!challenge) {
        return res.status(404).json({ error: 'Sesja wygasła. Wróć do ekranu PIN.' });
      }

      // Minimalny odstęp między SMS: 30 sekund
      const elapsedMs = Date.now() - challenge.createdAt.getTime();
      if (elapsedMs < 30 * 1000) {
        const waitSec = Math.ceil((30 * 1000 - elapsedMs) / 1000);
        return res.status(429).json({ error: `Odczekaj jeszcze ${waitSec} s przed ponownym wysłaniem kodu.` });
      }

      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      const newHash = crypto
        .createHash('sha256')
        .update(`${newCode}:${SUPERADMIN_SECRET}`)
        .digest('hex');

      await prisma.adminChallenge.update({
        where: { id: challengeId },
        data: {
          codeHash: newHash,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          attempts: 0,
          createdAt: new Date()
        }
      });

      const smsMessage = `EVA SuperAdmin: Twój nowy kod logowania to: ${newCode}. Kod jest ważny przez 5 minut.`;
      const sent = await SMSService.sendSMS(SUPERADMIN_PHONE, smsMessage);

      if (!sent) {
        return res.status(500).json({ error: 'Błąd bramki SMS przy ponownej wysyłce.' });
      }

      console.log(`📲 [Admin 2FA] Ponownie wysłano kod SMS na numer ${SUPERADMIN_PHONE}`);
      return res.status(200).json({ success: true, maskedPhone: '+48 531 *** 626', expiresInSeconds: 300 });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  /**
   * Punkt wejścia /api/admin/login:
   * Gdy podano tylko PIN -> uruchamia procedurę dwuetapową (zwraca krok 2FA).
   * Gdy podano kod 2FA -> weryfikuje kod i wydaje token.
   */
  public async login(req: Request, res: Response) {
    if (req.body.code && req.body.challengeId) {
      return this.verify2FA(req, res);
    }
    return this.initiateLogin(req, res);
  }
  
  public async getTenants(req: Request, res: Response) {
    try {
      const tenants = await prisma.tenant.findMany({
        include: {
          subscription: true,
          _count: {
            select: { appointments: true, customers: true }
          }
        },
        orderBy: [
          { riskLevel: 'desc' }, 
          { createdAt: 'desc' }
        ]
      });
      
      res.status(200).json(tenants);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  public async getTenantDetails(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: {
          faqEntries: true,
          subscription: true
        }
      });
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      res.status(200).json(tenant);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  public async suspendTenant(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { suspend } = req.body;
      const updated = await prisma.tenant.update({
        where: { id },
        data: { isSuspended: suspend }
      });
      res.status(200).json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  public async approveTenant(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const updated = await prisma.tenant.update({
        where: { id },
        data: { riskLevel: 'LOW', moderationNotes: null }
      });
      res.status(200).json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  public async adjustMinutes(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { additionalMinutes } = req.body;
      
      const sub = await prisma.subscription.findUnique({ where: { tenantId: id } });
      if (!sub) return res.status(404).json({ error: 'No subscription found' });
      
      const updated = await prisma.subscription.update({
        where: { tenantId: id },
        data: { minutesIncluded: sub.minutesIncluded + additionalMinutes }
      });
      res.status(200).json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  public async sendSmsNotification(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { message } = req.body;
      
      const tenant = await prisma.tenant.findUnique({ where: { id } });
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      
      const { SMSService } = await import('../services/sms/SMSService');
      const sent = await SMSService.sendSMS(tenant.phoneNumber, message || "Masz nową wiadomość od BeautyVoice AI.");
      
      if (sent) {
        res.status(200).json({ success: true });
      } else {
        res.status(500).json({ error: 'Nie udało się wysłać SMS' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  public async setSubscriptionStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      const pausedUntil = status === 'paused' ? new Date(Date.now() + 30 * 24 * 3600 * 1000) : null;
      const sub = await prisma.subscription.update({
        where: { tenantId: id },
        data: {
          status,
          pausedAt: status === 'paused' ? new Date() : null,
          pausedUntil
        }
      });
      res.status(200).json(sub);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  public async registerAdminDevice(req: Request, res: Response) {
    try {
      const { token, label } = req.body;
      if (!token) return res.status(400).json({ error: 'Token FCM jest wymagany' });

      await prisma.adminDevice.upsert({
        where: { token },
        create: {
          token,
          label: label || 'PWA SuperAdmin'
        },
        update: {
          label: label || 'PWA SuperAdmin',
          updatedAt: new Date()
        }
      });

      console.log(`📱 [AdminController] Zarejestrowano urządzenie SuperAdmina do powiadomień Push!`);
      res.json({ success: true, message: 'Urządzenie zarejestrowane pomyślnie' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  public async getBetaApplications(req: Request, res: Response) {
    try {
      const applications = await prisma.tenant.findMany({
        where: {
          betaStatus: { not: 'none' }
        },
        include: {
          subscription: true
        },
        orderBy: {
          betaRequestedAt: 'desc'
        }
      });
      res.json(applications);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  public async approveBetaApplication(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { assignedPhoneNumber, pinCode, minutesIncluded } = req.body;

      if (!assignedPhoneNumber || !assignedPhoneNumber.trim()) {
        return res.status(400).json({ error: 'Należy podać zakupiony numer wirtualny (np. +48...)' });
      }

      const cleanNumber = assignedPhoneNumber.trim().replace(/\s+/g, '');

      // Sprawdź czy numer nie jest już zajęty przez inny salon
      const existing = await prisma.tenant.findFirst({
        where: {
          assignedPhoneNumber: cleanNumber,
          id: { not: id }
        }
      });

      if (existing) {
        return res.status(400).json({ error: `Numer ${cleanNumber} jest już przypisany do firmy: ${existing.name}` });
      }

      const existingTenant = await prisma.tenant.findUnique({ where: { id } });
      if (!existingTenant) {
        return res.status(404).json({ error: 'Nie znaleziono firmy' });
      }

      // Jeśli użytkownik ustalił już PIN przy rejestracji, zachowujemy go (chyba że admin celowo podał inny)
      const finalPin = (pinCode && pinCode.trim()) 
        ? pinCode.trim() 
        : (existingTenant.pinCode || Math.floor(1000 + Math.random() * 9000).toString());
      const minutes = minutesIncluded ? parseInt(minutesIncluded, 10) : 300;

      const tenant = await prisma.tenant.update({
        where: { id },
        data: {
          assignedPhoneNumber: cleanNumber,
          pinCode: finalPin,
          betaStatus: 'approved',
          betaApprovedAt: new Date(),
          termsAcceptedAt: new Date()
        }
      });

      const isPersonal = existingTenant.businessProfile === 'personal';
      const targetPlan = isPersonal ? 'personal_expert' : 'premium';

      await prisma.subscription.upsert({
        where: { tenantId: id },
        create: {
          tenantId: id,
          planName: targetPlan,
          status: 'active',
          minutesIncluded: minutes,
          minutesUsed: 0
        },
        update: {
          planName: targetPlan,
          status: 'active',
          minutesIncluded: minutes
        }
      });

      // Wysłanie powiadomienia SMS o aktywacji numeru
      const { SMSService } = await import('../services/sms/SMSService');
      const smsBody = isPersonal
        ? `Twój osobisty asystent EVA jest gotowy! Dedykowany numer: ${cleanNumber}. Zaloguj się do panelu: https://beautyvoice-bff.web.app/dashboard`
        : `Twój asystent EVA dla firmy ${tenant.name} jest gotowy! Dedykowany numer: ${cleanNumber}. Zaloguj się do panelu swoim numerem telefonu i ustalonym PIN-em: https://beautyvoice-bff.web.app/dashboard`;
      
      const smsSent = await SMSService.sendSMS(tenant.phoneNumber, smsBody);

      console.log(`🎉 [Beta Approval] Aktywowano (${targetPlan}) ${tenant.name}, przypisano numer ${cleanNumber}, PIN: ${finalPin}. SMS wysłany: ${smsSent}`);

      res.json({
        success: true,
        tenant,
        assignedPhoneNumber: cleanNumber,
        pinCode: finalPin,
        smsSent
      });
    } catch (e: any) {
      console.error('[AdminController] approveBetaApplication error:', e);
      res.status(500).json({ error: e.message });
    }
  }

  public async deleteBetaApplication(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const deleteAccount = req.query.deleteAccount === 'true';

      const tenant = await prisma.tenant.findUnique({ where: { id } });
      if (!tenant) return res.status(404).json({ error: 'Nie znaleziono firmy' });

      if (deleteAccount) {
        await prisma.tenant.delete({ where: { id } });
        console.log(`🗑️ [SuperAdmin] Całkowicie usunięto konto testowe ${tenant.name} (${id})`);
        return res.json({ success: true, message: `Konto ${tenant.name} oraz wniosek zostały bezpowrotnie usunięte.` });
      } else {
        const updated = await prisma.tenant.update({
          where: { id },
          data: {
            betaStatus: 'none',
            betaRequestedAt: null,
            betaApprovedAt: null,
            betaContactPerson: null,
            betaContactEmail: null,
            betaNotes: null
          }
        });
        console.log(`🗑️ [SuperAdmin] Usunięto wniosek pilotażowy dla ${tenant.name} (${id})`);
        return res.json({ success: true, message: `Wniosek pilotażowy dla ${tenant.name} został pomyślnie usunięty.`, tenant: updated });
      }
    } catch (e: any) {
      console.error('[AdminController] deleteBetaApplication error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  public async deleteTenant(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const tenant = await prisma.tenant.findUnique({ where: { id } });
      if (!tenant) return res.status(404).json({ error: 'Nie znaleziono firmy' });

      // Kaskadowe usunięcie powiązanych danych
      await prisma.appointment.deleteMany({ where: { tenantId: id } });
      await prisma.callLog.deleteMany({ where: { tenantId: id } });
      await prisma.faqEntry.deleteMany({ where: { tenantId: id } });
      await prisma.service.deleteMany({ where: { tenantId: id } });
      await prisma.staffMember.deleteMany({ where: { tenantId: id } });
      await prisma.resource.deleteMany({ where: { tenantId: id } });
      await prisma.timeOff.deleteMany({ where: { tenantId: id } });
      await prisma.customer.deleteMany({ where: { tenantId: id } });
      await prisma.campaign.deleteMany({ where: { tenantId: id } });
      await prisma.outboundQueue.deleteMany({ where: { tenantId: id } });
      await prisma.vipContact.deleteMany({ where: { tenantId: id } });
      await prisma.annualEvent.deleteMany({ where: { tenantId: id } });
      await prisma.subscription.deleteMany({ where: { tenantId: id } });

      await prisma.tenant.delete({ where: { id } });
      console.log(`🗑️ [SuperAdmin] Całkowicie usunięto konto firmy ${tenant.name} (${id})`);
      return res.json({ success: true, message: `Konto ${tenant.name} zostało trwale usunięte.` });
    } catch (e: any) {
      console.error('[AdminController] deleteTenant error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  public async deleteTenantFaqEntry(req: Request, res: Response) {
    try {
      const tenantId = req.params.tenantId as string;
      const faqId = req.params.faqId as string;
      const faq = await prisma.faqEntry.findUnique({ where: { id: faqId } });
      if (!faq || faq.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Nie znaleziono wpisu FAQ dla tego tenanta' });
      }

      await prisma.faqEntry.delete({ where: { id: faqId } });
      console.log(`🗑️ [SuperAdmin] Usunięto wpis FAQ (${faqId}) dla tenanta ${tenantId}`);

      // Po usunięciu wpisu automatycznie przelicz audyt moderacji
      const { moderationService } = await import('../services/ModerationService');
      const auditResult = await moderationService.moderateTenant(tenantId);

      return res.json({ success: true, message: 'Wpis FAQ został usunięty.', auditResult });
    } catch (e: any) {
      console.error('[AdminController] deleteTenantFaqEntry error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  public async auditTenantKnowledge(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const tenant = await prisma.tenant.findUnique({ where: { id } });
      if (!tenant) return res.status(404).json({ error: 'Nie znaleziono firmy' });

      const { moderationService } = await import('../services/ModerationService');
      const result = await moderationService.moderateTenant(id);

      const updated = await prisma.tenant.findUnique({ 
        where: { id }, 
        select: { riskLevel: true, moderationNotes: true } 
      });

      return res.json({
        success: true,
        riskLevel: updated?.riskLevel,
        moderationNotes: updated?.moderationNotes,
        reason: result.reason
      });
    } catch (e: any) {
      console.error('[AdminController] auditTenantKnowledge error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  public async getPlatformStats(req: Request, res: Response) {
    try {
      const [totalTenants, highRiskTenants, suspendedTenants, pendingBeta, subscriptions, totalAppts, totalCalls] = await Promise.all([
        prisma.tenant.count({ where: { name: { not: 'DEMO' } } }),
        prisma.tenant.count({ where: { riskLevel: 'HIGH', name: { not: 'DEMO' } } }),
        prisma.tenant.count({ where: { isSuspended: true, name: { not: 'DEMO' } } }),
        prisma.tenant.count({ where: { betaStatus: 'pending' } }),
        prisma.subscription.findMany({ select: { minutesUsed: true, minutesIncluded: true } }),
        prisma.appointment.count(),
        prisma.callLog.count()
      ]);

      const totalMinutesUsed = subscriptions.reduce((sum, s) => sum + (s.minutesUsed || 0), 0);
      const totalMinutesIncluded = subscriptions.reduce((sum, s) => sum + (s.minutesIncluded || 0), 0);

      return res.json({
        totalTenants,
        highRiskTenants,
        suspendedTenants,
        pendingBeta,
        totalMinutesUsed,
        totalMinutesIncluded,
        totalAppts,
        totalCalls
      });
    } catch (e: any) {
      console.error('[AdminController] getPlatformStats error:', e);
      return res.status(500).json({ error: e.message });
    }
  }
}

export const adminController = new AdminController();


