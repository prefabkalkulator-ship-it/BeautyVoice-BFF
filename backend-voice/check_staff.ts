import { prisma } from './src/prisma.ts';
prisma.staffMember.findMany().then(s => console.dir(s, {depth: null})).finally(() => prisma.$disconnect());
