import { prisma } from './src/prisma.ts';
prisma.service.findFirst({
  where: { name: { contains: 'fade' } },
  include: { staffMembers: { include: { staff: true } } }
}).then(s => console.log(JSON.stringify(s, null, 2))).finally(() => prisma.$disconnect());
