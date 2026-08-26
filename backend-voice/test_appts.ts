import { prisma } from './src/prisma.ts';
prisma.appointment.findMany().then(a => console.log(JSON.stringify(a, null, 2))).finally(() => prisma.$disconnect());
