import { prisma } from './src/prisma.ts'; async function run() { const s = await prisma.service.findMany(); console.log(JSON.stringify(s, null, 2)); } run();
