const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');
let start = code.indexOf("msg.content");
console.log(code.substring(start - 200, start + 300));
