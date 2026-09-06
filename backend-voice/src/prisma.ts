import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
// Zwiększamy connectionTimeoutMillis i statement_timeout żeby PgBouncer nie wywalał błędów timeoutu
const pool = new Pool({ 
  connectionString, 
  connectionTimeoutMillis: 10000,
  statement_timeout: 10000 
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
