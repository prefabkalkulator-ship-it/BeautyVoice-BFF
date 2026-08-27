const fs = require('fs');
let code = fs.readFileSync('src/components/AppointmentsDaily.tsx', 'utf8');
let start = code.indexOf("className={`absolute left-0 right-0 z-10");
console.log(code.substring(start - 200, start + 1000));
