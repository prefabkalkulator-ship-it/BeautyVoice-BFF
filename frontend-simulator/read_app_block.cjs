const fs = require('fs');
let code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');
let start = code.indexOf("{apps.map(app => {");
console.log(code.substring(start, start + 1200));
