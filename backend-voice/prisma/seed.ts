import { prisma } from '../src/prisma';

async function main() {
  console.log('Seeding test data...');

  // 1. Create a test tenant
  const tenant = await prisma.tenant.upsert({
    where: { phoneNumber: '+48111222333' },
    update: {},
    create: {
      name: 'BeautyVoice Demo Salon',
      phoneNumber: '+48111222333',
    },
  });

  console.log('Tenant created:', tenant.id);

  // 2. Create services
  // Clear first to avoid duplicates if run multiple times
  await prisma.service.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.service.createMany({
    data: [
      { tenantId: tenant.id, name: 'Strzyżenie klasyczne fade', price: 60, durationMinutes: 30 },
      { tenantId: tenant.id, name: 'Strzyżenie brody', price: 60, durationMinutes: 30 },
      { tenantId: tenant.id, name: 'Combo (włosy + broda)', price: 100, durationMinutes: 60 },
    ],
  });

  // 3. Create FAQ
  await prisma.faqEntry.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.faqEntry.createMany({
    data: [
      { tenantId: tenant.id, question: 'Gdzie znajduje się salon?', answer: 'Znajdujemy się w Warszawie przy ulicy Przykładowej 1.' },
      { tenantId: tenant.id, question: 'Czy można płacić kartą?', answer: 'Tak, obsługujemy płatności kartą oraz BLIK.' },
    ],
  });

  console.log('Seed completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
