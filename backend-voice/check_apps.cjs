const { prisma } = require('./dist/prisma.js');

async function checkApps() {
  const tasks = await prisma.appointment.findMany({
    take: 10
  });
  console.log(JSON.stringify(tasks.map(t => ({
    id: t.id,
    customerName: t.customerName,
    status: t.status,
    startTime: t.startTime
  })), null, 2));
}

checkApps().catch(console.error).finally(() => prisma.$disconnect());
