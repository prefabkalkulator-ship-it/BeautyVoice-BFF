const fs = require('fs');
const code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');
const start = code.indexOf('key={app.id}');
console.log(code.substring(start, start + 800));
