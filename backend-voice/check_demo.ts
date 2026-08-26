import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const t = await prisma.tenant.findMany();
  console.log(t);
  
  // ensure DEMO exists
  let demo = await prisma.tenant.findFirst({ where: { name: 'DEMO' } });
  if (!demo) {
    demo = await prisma.tenant.create({
      data: {
        name: 'DEMO',
        email: 'demo@easyvoiceassistant.pl',
        phone: '+48343433088',
        assignedPhoneNumber: '+48343433088',
        businessProfile: 'facility',
        aiVoice: 'Aoede',
        botName: 'EVA'
      }
    });
    console.log('Created DEMO tenant:', demo);
  } else {
    // ensure phone number
    if (demo.assignedPhoneNumber !== '+48343433088') {
      await prisma.tenant.update({
        where: { id: demo.id },
        data: { assignedPhoneNumber: '+48343433088' }
      });
      console.log('Updated DEMO phone number');
    }
  }
}
main();
