import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
// Konfiguracja puli połączeń z keepAlive i idleTimeoutMillis, aby zapobiec zrywaniu bezczynnych gniazd TCP w Cloud Run
const pool = new Pool({ 
  connectionString, 
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 10000,
  keepAlive: true,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
