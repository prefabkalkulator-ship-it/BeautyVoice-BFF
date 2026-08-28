const fs = require('fs');
let code = fs.readFileSync('src/components/AppointmentsDaily.tsx', 'utf8');

code = code.replace(/app\.status === 'confirmed'/g, "app.status === 'confirmed_by_client'");
fs.writeFileSync('src/components/AppointmentsDaily.tsx', code, 'utf8');

let code2 = fs.readFileSync('src/components/Appointments.tsx', 'utf8');
code2 = code2.replace(/app\.status === 'confirmed'/g, "app.status === 'confirmed_by_client'");
fs.writeFileSync('src/components/Appointments.tsx', code2, 'utf8');
