const { Client } = require('zadarma-api');
const api = new Client('45d238eb0c44b12172bc', '254674b0b6e9a2662df8');

async function check() {
  try {
    const res = await api.call('/v1/request/callback/', {
      from: '100',
      to: '+48533989987'
    }, 'POST');
    console.log("Tried 100:", res);
  } catch (err) {
    console.error("Tried 100 ERROR:", err.message);
  }
}
check();
