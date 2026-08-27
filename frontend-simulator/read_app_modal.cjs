const fs = require('fs');
let code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');
let start = code.indexOf("<div className=\"p-6 bg-white overflow-y-auto\" style={{ maxHeight: 'calc(90vh - 140px)' }}>");
console.log(code.substring(start, start + 1000));
