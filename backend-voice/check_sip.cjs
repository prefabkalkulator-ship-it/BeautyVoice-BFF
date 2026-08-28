const { Client } = require('zadarma-api');
const api = new Client('45d238eb0c44b12172bc', '254674b0b6e9a2662df8');

async function check() {
  try {
    const res = await api.call('/v1/sip/', {}, 'GET');
    console.log(res);
  } catch (err) {
    console.error(err);
  }
}
check();
