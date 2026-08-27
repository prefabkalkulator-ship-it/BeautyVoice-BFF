const fs = require('fs');
let code = fs.readFileSync('prisma/schema.prisma', 'utf8');
let start = code.indexOf("model Tenant {");
console.log(code.substring(start, start + 300));
