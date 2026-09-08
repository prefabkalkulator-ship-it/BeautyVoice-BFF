import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { createAdminToken } from '../middleware/adminAuth';

export class AdminController {
  
  public async login(req: Request, res: Response) {
    try {
      const { pin } = req.body;
      const expectedPin = process.env.SUPERADMIN_PIN || '5742';

      if (!pin || String(pin).trim() !== expectedPin) {
        return res.status(401).json({ error: 'Nieprawidłowy kod PIN administratora.' });
      }

      const token = createAdminToken();
      console.log('🔑 [SuperAdmin] Pomyślne logowanie administratora!');
      return res.json({ success: true, token, expiresInDays: 7 });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
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

      await prisma.subscription.upsert({
        where: { tenantId: id },
        create: {
          tenantId: id,
          planName: 'premium', // Udostępniamy od razu pełny pakiet Premium
          status: 'active',
          minutesIncluded: minutes,
          minutesUsed: 0
        },
        update: {
          planName: 'premium', // Udostępniamy od razu pełny pakiet Premium
          status: 'active',
          minutesIncluded: minutes
        }
      });

      // Wysłanie powiadomienia SMS o aktywacji numeru
      const { SMSService } = await import('../services/sms/SMSService');
      const smsBody = `Twój asystent EVA dla firmy ${tenant.name} jest gotowy! Dedykowany numer: ${cleanNumber}. Zaloguj się do panelu swoim numerem telefonu i ustalonym PIN-em: https://beautyvoice-bff.web.app/dashboard`;
      
      const smsSent = await SMSService.sendSMS(tenant.phoneNumber, smsBody);

      console.log(`🎉 [Beta Approval] Aktywowano firmę ${tenant.name}, przypisano numer ${cleanNumber}, PIN: ${finalPin}. SMS wysłany: ${smsSent}`);

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
}

export const adminController = new AdminController();


