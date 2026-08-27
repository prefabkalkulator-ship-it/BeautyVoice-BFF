const fs = require('fs');
let code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');
let start = code.indexOf("const bgColor = getColorCode(app.service?.id || '');");
console.log(code.substring(start, start + 1000));
