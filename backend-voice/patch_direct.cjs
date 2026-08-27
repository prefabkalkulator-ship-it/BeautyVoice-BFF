const fs = require('fs');
let code = fs.readFileSync('prisma/schema.prisma', 'utf8');

code = code.replace(
  'datasource db {\n  provider = "postgresql"\n}',
  'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}'
);

fs.writeFileSync('prisma/schema.prisma', code, 'utf8');

let env = fs.readFileSync('.env', 'utf8');
env += '\nDIRECT_URL="postgresql://postgres.wzlrwsqotswrpalbricg:E9DOkLWqLPHQ6Q35@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"\n';
fs.writeFileSync('.env', env, 'utf8');
