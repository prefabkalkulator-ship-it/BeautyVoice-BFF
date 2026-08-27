const fs = require('fs');
let code = fs.readFileSync('src/services/BookingService.ts', 'utf8');

const search = `public async updateCustomerSource(tenantId: string, customerPhone: string, source: string): Promise<boolean> {`;
const replace = `public async saveNpsScore(tenantId: string, phone: string, score: number): Promise<boolean> {
    try {
      const now = new Date();
      const lastApp = await prisma.appointment.findFirst({
        where: {
          tenantId,
          customerPhone: phone,
          endTime: { lt: now },
          surveySent: true
        },
        orderBy: { endTime: 'desc' }
      });
      if (!lastApp) return false;
      await prisma.appointment.update({
        where: { id: lastApp.id },
        data: { npsScore: score }
      });
      return true;
    } catch (error) {
      console.error('Error saving NPS score:', error);
      return false;
    }
  }

  public async updateCustomerSource(tenantId: string, customerPhone: string, source: string): Promise<boolean> {`;

code = code.replace(search, replace);
fs.writeFileSync('src/services/BookingService.ts', code, 'utf8');
