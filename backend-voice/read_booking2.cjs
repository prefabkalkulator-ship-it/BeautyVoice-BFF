const fs = require('fs');
let code = fs.readFileSync('src/services/BookingService.ts', 'utf8');
let start = code.indexOf("saveNpsScore");
console.log(code.substring(start - 200, start + 300));
