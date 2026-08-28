const { prisma } = require('./dist/prisma.js');

async function resetFailed() {
  await prisma.outboundQueue.updateMany({
    where: { status: 'failed', channel: 'voice' },
    data: { status: 'pending' }
  });
  console.log('Zresetowano nieudane zadania do pending.');
}

resetFailed().catch(console.error).finally(() => prisma.$disconnect());
