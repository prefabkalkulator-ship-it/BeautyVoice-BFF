const fs = require('fs');
const code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');
const start = code.indexOf('setAppointments');
console.log(code.substring(start - 200, start + 800));
