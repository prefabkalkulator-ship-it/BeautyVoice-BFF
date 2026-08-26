import { prisma } from './src/prisma.ts';
import { BookingService } from './src/services/BookingService.ts';
const svc = new BookingService();
prisma.service.findMany().then(async (services) => {
  const sName = services.find(s => s.name.includes('fade')).name;
  console.log('Testing with service:', sName);
  const r1 = await svc.checkAvailability('acbd641a-99da-47f5-9246-818fd152fdcb', '2026-08-24', sName, 30, 'Alicja');
  console.log('Result 1:', r1);
  const r2 = await svc.checkAvailability('acbd641a-99da-47f5-9246-818fd152fdcb', '2026-08-24', sName, 30);
  console.log('Result 2:', r2);
}).finally(() => prisma.$disconnect());
