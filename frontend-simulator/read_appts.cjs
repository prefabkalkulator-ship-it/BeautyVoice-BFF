const fs = require('fs');
const code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');
const start = code.indexOf('className="absolute top-2 bottom-2 rounded-lg');
console.log(code.substring(start, start + 300));
