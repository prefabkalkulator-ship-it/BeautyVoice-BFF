import { Request, Response } from 'express';
import { prisma } from '../prisma';

export class AdminController {
  
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
}

export const adminController = new AdminController();

