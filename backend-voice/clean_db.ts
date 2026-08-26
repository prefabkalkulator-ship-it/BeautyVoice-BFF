import { prisma } from './src/prisma.ts';

async function main() {
  const demo = await prisma.tenant.findFirst({ where: { name: 'DEMO' } });
  console.log("DEMO Tenant:", demo?.id);
  
  if (demo) {
    const deleted = await prisma.tenant.deleteMany({
      where: { name: { not: 'DEMO' } }
    });
    console.log(`Deleted ${deleted.count} garbage tenants.`);
  } else {
    console.log("DEMO Tenant not found, not risking deletion!");
  }
}
main().catch(console.error).finally(() => process.exit(0));
