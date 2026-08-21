import { prisma } from './prisma'; async function main() { await prisma.staffMember.updateMany({ data: { workingHours: '08:00-20:00' } }); } main().finally(() => prisma.$disconnect());
