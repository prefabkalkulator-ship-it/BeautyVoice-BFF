const fs = require('fs');
let code = fs.readFileSync('prisma/schema.prisma', 'utf8');
let start = code.indexOf("model Tenant {");
let end = code.indexOf("}", start);
console.log(code.substring(start, end));
