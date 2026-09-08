import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { SMSService } from '../services/sms/SMSService';
import { PushService } from '../services/PushService';
import { EmailService } from '../services/email/EmailService';

export class BetaController {
  
  public async apply(req: Request, res: Response) {
    try {
      const { tenantId, salonName, contactPerson, contactPhone, contactEmail, notes } = req.body;

      if (!contactPhone) {
        return res.status(400).json({ error: 'Numer telefonu kontaktowego jest wymagany.' });
      }

      if (!contactEmail) {
        return res.status(400).json({ error: 'Adres e-mail jest wymagany.' });
      }

      // Walidacja numeru kontaktowego pod kątem możliwości odebrania SMS
      const classification = SMSService.classifyPhoneNumber(contactPhone);
      if (classification.isLandline) {
        return res.status(400).json({ 
          error: 'Podany numer to telefon stacjonarny. Prosimy podać numer komórkowy, aby otrzymać kod PIN aktywacyjny przez SMS.' 
        });
      }

      if (!classification.isValid || !classification.isMobile) {
        return res.status(400).json({ 
          error: 'Nieprawidłowy numer telefonu komórkowego. Sprawdź format numeru.' 
        });
      }

      // Znajdź tenanta
      let tenant = null;
      if (tenantId && tenantId !== '00000000-0000-0000-0000-000000000000') {
        tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      }

      if (!tenant) {
        // Fallback: szukaj po numerze lub weź pierwszy rekord
        tenant = await prisma.tenant.findFirst({
          where: { phoneNumber: classification.formattedNumber }
        });
      }

      if (!tenant) {
        tenant = await prisma.tenant.findFirst();
      }

      if (!tenant) {
        return res.status(404).json({ error: 'Nie znaleziono konta salonu.' });
      }

      const formattedPhone = classification.formattedNumber;
      const updatedSalonName = salonName ? salonName.trim() : tenant.name;

      // Aktualizacja statusu Beta w bazie
      const updatedTenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          name: updatedSalonName,
          contactEmail: contactEmail.trim(),
          betaStatus: 'pending',
          betaContactPerson: contactPerson ? contactPerson.trim() : null,
          betaContactEmail: contactEmail.trim(),
          betaNotes: notes ? notes.trim() : null,
          betaRequestedAt: new Date()
        }
      });

      // 1. Wysyłka powiadomienia Push do SuperAdmina (PWA)
      try {
        const adminDevices = await prisma.adminDevice.findMany();
        const tokens = adminDevices.map(d => d.token);
        if (tokens.length > 0) {
          await PushService.sendNotification(
            tokens,
            '🔔 Nowy wniosek pilotażowy EVA!',
            `Firma ${updatedSalonName} (${formattedPhone}) prosi o aktywację pakietu pilotażowego Premium.`,
            'https://beautyvoice-bff.web.app/superadmin',
            formattedPhone
          );
        }
      } catch (pushErr) {
        console.error('[BetaController] Błąd wysyłki push do admina:', pushErr);
      }

      // 2. Wysyłka alertu E-mail przez SMTP
      try {
        await EmailService.sendBetaApplicationAlert({
          tenantName: updatedSalonName,
          contactPerson: contactPerson || 'Nie podano',
          contactEmail: contactEmail.trim(),
          contactPhone: formattedPhone,
          notes: notes ? notes.trim() : undefined
        });
      } catch (emailErr) {
        console.error('[BetaController] Błąd wysyłki e-maila do admina:', emailErr);
      }

      return res.json({ 
        success: true, 
        message: 'Wniosek został pomyślnie wysłany. Administrator wkrótce skonfiguruje Twój dedykowany numer i aktywuje konto.',
        tenant: {
          id: updatedTenant.id,
          phoneNumber: updatedTenant.phoneNumber,
          betaStatus: updatedTenant.betaStatus,
          betaRequestedAt: updatedTenant.betaRequestedAt
        }
      });
    } catch (err: any) {
      console.error('[BetaController] Błąd wniosku beta:', err);
      return res.status(500).json({ error: 'Wystąpił błąd podczas przetwarzania wniosku: ' + err.message });
    }
  }

  public async getStatus(req: Request, res: Response) {
    try {
      const tenantId = req.query.tenantId as string;
      let tenant = null;

      if (tenantId && tenantId !== '00000000-0000-0000-0000-000000000000') {
        tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          include: { subscription: true }
        });
      }

      if (!tenant) {
        tenant = await prisma.tenant.findFirst({
          include: { subscription: true }
        });
      }

      if (!tenant) {
        return res.status(404).json({ error: 'Nie znaleziono firmy.' });
      }

      return res.json({
        id: tenant.id,
        name: tenant.name,
        phoneNumber: tenant.phoneNumber,
        assignedPhoneNumber: tenant.assignedPhoneNumber,
        betaStatus: tenant.betaStatus,
        betaContactPerson: tenant.betaContactPerson,
        betaContactEmail: tenant.betaContactEmail,
        betaRequestedAt: tenant.betaRequestedAt,
        betaApprovedAt: tenant.betaApprovedAt,
        subscription: tenant.subscription
      });
    } catch (err: any) {
      console.error('[BetaController] getStatus error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}

export const betaController = new BetaController();
