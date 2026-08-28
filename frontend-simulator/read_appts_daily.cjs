const fs = require('fs');
const code = fs.readFileSync('src/components/AppointmentsDaily.tsx', 'utf8');
const start = code.indexOf('key={app.id}');
console.log(code.substring(start - 200, start + 800));
