const fs = require('fs');
let code = fs.readFileSync('src/components/AppointmentsDaily.tsx', 'utf8');
let start = code.indexOf("!isEditing && selectedAppt.id !== 'new' ? (");
if (start > -1) {
  console.log(code.substring(start, start + 1500));
} else {
  console.log('Not found');
}
