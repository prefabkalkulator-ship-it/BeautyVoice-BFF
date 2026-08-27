const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowEnd = new Date(tomorrow);
  tomorrow.setHours(0,0,0,0);
  tomorrowEnd.setHours(23,59,59,999);
  
  const appts = await prisma.appointment.findMany({
    where: { startTime: { gte: tomorrow, lte: tomorrowEnd } }
  });
  console.log("Jutrzejsze rezerwacje:");
  console.log(appts.map(a => ({ id: a.id, phone: a.customerPhone, status: a.status })));
}
check().finally(() => prisma.$disconnect());
