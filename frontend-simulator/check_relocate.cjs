const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');
let start = code.indexOf("msg.id === '1'");
if (start > -1) {
  console.log(code.substring(start - 100, start + 300));
} else {
  console.log('Not found');
}
