const { Client } = require('zadarma-api');
const api = new Client('45d238eb0c44b12172bc', '254674b0b6e9a2662df8');

async function check() {
  try {
    const res = await api.call('/v1/statistics/', {
      start: '2026-08-28 10:00:00',
      end: '2026-08-28 23:59:59'
    }, 'GET');
    console.log("Stats:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Stats ERROR:", err.message);
  }
}
check();
