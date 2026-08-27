const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.wzlrwsqotswrpalbricg:E9DOkLWqLPHQ6Q35@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

async function run() {
  await client.connect();
  try {
    await client.query('ALTER TABLE "Customer" ADD COLUMN "source" TEXT;');
    console.log('Added source to Customer');
  } catch (e) {
    console.log(e.message);
  }
  try {
    await client.query('ALTER TABLE "Appointment" ADD COLUMN "promoCode" TEXT;');
    console.log('Added promoCode to Appointment');
  } catch (e) {
    console.log(e.message);
  }
  await client.end();
}
run();
