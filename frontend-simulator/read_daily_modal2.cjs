const fs = require('fs');
let code = fs.readFileSync('src/components/AppointmentsDaily.tsx', 'utf8');
let start = code.indexOf("<div className=\"p-6 bg-white overflow-y-auto\"");
if (start === -1) start = code.indexOf("isModalOpen && (");
console.log(code.substring(start, start + 1500));
