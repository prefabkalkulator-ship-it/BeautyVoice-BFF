import { prisma } from './src/prisma.ts';
import { BookingService } from './src/services/BookingService.ts';
const svc = new BookingService();
prisma.service.findMany().then(async (services) => {
  const sName = services[0].name;
  console.log('Testing with exact service:', sName);
  const r1 = await svc.checkAvailability('acbd641a-99da-47f5-9246-818fd152fdcb', '2026-08-24', sName, 30);
  console.log('Result for Monday:', r1);
}).finally(() => prisma.$disconnect());
