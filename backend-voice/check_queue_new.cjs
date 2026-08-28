const { prisma } = require('./dist/prisma.js');

async function checkQueue() {
  const tasks = await prisma.outboundQueue.findMany({
    orderBy: { scheduledFor: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(tasks.map(t => ({
    id: t.id,
    targetPhone: t.targetPhone,
    channel: t.channel,
    status: t.status,
    errorMessage: t.errorMessage,
    payload: t.payload
  })), null, 2));
}

checkQueue().catch(console.error).finally(() => prisma.$disconnect());
