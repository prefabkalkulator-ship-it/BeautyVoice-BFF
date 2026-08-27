const fs = require('fs');
let code = fs.readFileSync('src/services/BookingService.ts', 'utf8');
let start = code.indexOf("public async bookAppointment(");
console.log(code.substring(start, start + 300));
