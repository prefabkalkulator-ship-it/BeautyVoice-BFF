import { prisma } from './src/prisma';
async function fix() {
  await prisma.subscription.updateMany({
    data: { planName: 'standard', minutesIncluded: 100 }
  });
}
fix().catch(console.error).finally(() => prisma.$disconnect());
