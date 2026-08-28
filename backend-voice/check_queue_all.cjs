const { prisma } = require('./dist/prisma.js');

async function checkQueue() {
  const tasks = await prisma.outboundQueue.findMany({
    orderBy: { scheduledFor: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(tasks.map(t => ({ id: t.id, channel: t.channel, payload: t.payload })), null, 2));
}

checkQueue().catch(console.error).finally(() => prisma.$disconnect());
