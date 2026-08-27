const fs = require('fs');
let code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');

let appStart = code.indexOf('interface Appointment {');
console.log(code.substring(appStart, appStart + 400));
