const fs = require('fs');
let code = fs.readFileSync('src/components/AppointmentsDaily.tsx', 'utf8');
let start = code.indexOf("export default function AppointmentsDaily");
console.log(code.substring(start, start + 1000));
