import { prisma } from './src/prisma';
async function check() {
  const t = await prisma.tenant.findFirst({ where: { name: { not: 'DEMO' } } });
  console.log('Tenant:', t.id);
  const s = await prisma.subscription.findUnique({ where: { tenantId: t.id } });
  console.log('Sub:', s);
}
check().catch(console.error).finally(() => prisma.$disconnect());
