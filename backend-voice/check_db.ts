import "dotenv/config";
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const demo = await prisma.tenant.findFirst({ where: { name: 'DEMO' } });
  console.log("DEMO Tenant:", demo);
  
  const others = await prisma.tenant.findMany({ where: { name: { not: 'DEMO' } } });
  console.log("Other Tenants Count:", others.length);
  others.forEach(t => console.log(`- ${t.id} | ${t.name} | ${t.assignedPhoneNumber}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
