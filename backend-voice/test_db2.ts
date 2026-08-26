import { prisma } from './src/prisma';
async function check() {
  const tenants = await prisma.tenant.findMany({ include: { subscription: true } });
  console.dir(tenants, { depth: null });
}
check().catch(console.error).finally(() => prisma.$disconnect());
