const { prisma } = require('./dist/prisma.js');

async function checkQueue() {
  const tasks = await prisma.outboundQueue.findMany({
    orderBy: { scheduledFor: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(tasks, null, 2));
}

checkQueue().catch(console.error).finally(() => prisma.$disconnect());
