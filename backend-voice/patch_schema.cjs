const fs = require('fs');
let code = fs.readFileSync('prisma/schema.prisma', 'utf8');

code = code.replace(
  '  fcmTokens           String[]\n  createdAt           DateTime       @default(now())',
  '  fcmTokens           String[]\n  createdAt           DateTime       @default(now())\n  reviewLink          String? // Link do opinii Google'
);

code = code.replace(
  '  promoCode     String?\n  \n  tenant        Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)',
  '  promoCode     String?\n  npsScore      Int?\n  surveySent    Boolean      @default(false)\n  \n  tenant        Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)'
);

fs.writeFileSync('prisma/schema.prisma', code, 'utf8');
