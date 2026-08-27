const fs = require('fs');
let code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');
let start = code.indexOf("!isEditing && selectedAppt.id !== 'new' ? (");
console.log(code.substring(start, start + 1500));
