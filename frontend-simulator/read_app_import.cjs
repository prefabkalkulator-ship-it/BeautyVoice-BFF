const fs = require('fs');
let code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');

let appStart = code.indexOf('import {');
console.log(code.substring(appStart, appStart + 200));
