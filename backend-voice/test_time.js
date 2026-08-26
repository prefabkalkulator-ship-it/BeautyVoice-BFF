const date = '2026-08-24';
const reqDate = new Date(date + 'T00:00:00+02:00');
const workStartStr = '09:00';
const [startH, startM] = workStartStr.split(':').map(Number);
const staffStartMs = reqDate.getTime() + (startH * 60 + startM) * 60000;
let currentSlot = reqDate.getTime() + 6 * 60 * 60 * 1000;

for (let i=0; i<8; i++) {
  const d = new Date(currentSlot);
  console.log('Slot:', d.toISOString(), 'ms:', currentSlot, 'staffStartMs:', staffStartMs, 'currentSlot < staffStartMs:', currentSlot < staffStartMs);
  currentSlot += 30 * 60000;
}
