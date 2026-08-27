const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/beautyvoice' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  const appts = await prisma.appointment.findMany({});
  console.log("Wszystkie rezerwacje:");
  console.log(appts.map(a => ({ id: a.id, phone: a.customerPhone, status: a.status })));
}
check().finally(() => prisma.$disconnect());
