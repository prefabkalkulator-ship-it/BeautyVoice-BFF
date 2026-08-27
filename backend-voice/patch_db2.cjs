const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.wzlrwsqotswrpalbricg:E9DOkLWqLPHQ6Q35@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

async function run() {
  await client.connect();
  try {
    await client.query('ALTER TABLE "Tenant" ADD COLUMN "reviewLink" TEXT;');
    console.log('Added reviewLink to Tenant');
  } catch (e) { console.log(e.message); }
  
  try {
    await client.query('ALTER TABLE "Appointment" ADD COLUMN "npsScore" INTEGER;');
    console.log('Added npsScore to Appointment');
  } catch (e) { console.log(e.message); }
  
  try {
    await client.query('ALTER TABLE "Appointment" ADD COLUMN "surveySent" BOOLEAN NOT NULL DEFAULT false;');
    console.log('Added surveySent to Appointment');
  } catch (e) { console.log(e.message); }
  
  await client.end();
}
run();
