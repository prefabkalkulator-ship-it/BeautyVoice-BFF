import { prisma } from './src/prisma.ts';
import { BookingService } from './src/services/BookingService.ts';
const svc = new BookingService();
svc.checkAvailability('acbd641a-99da-47f5-9246-818fd152fdcb', '2026-08-24', 'Strzy¿enie klasyczne fade', 30, 'Alicja')
  .then(console.log)
  .then(() => svc.checkAvailability('acbd641a-99da-47f5-9246-818fd152fdcb', '2026-08-24', 'Strzy¿enie klasyczne fade', 30))
  .then(console.log)
  .finally(() => prisma.$disconnect());
