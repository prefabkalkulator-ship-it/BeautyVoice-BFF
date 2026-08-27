const fs = require('fs');
let code = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Update Customer model
code = code.replace(
  "notes         String?       @db.Text\n    lastVisitAt   DateTime?",
  "notes         String?       @db.Text\n    source        String?       // Lead attribution np. Google, Facebook\n    lastVisitAt   DateTime?"
);

// Update Appointment model
code = code.replace(
  "status        String       @default(\"confirmed\") // confirmed, cancelled",
  "status        String       @default(\"confirmed\") // confirmed, cancelled\n    promoCode     String?"
);

fs.writeFileSync('prisma/schema.prisma', code, 'utf8');
