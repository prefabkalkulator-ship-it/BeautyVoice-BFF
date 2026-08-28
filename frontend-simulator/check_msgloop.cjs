const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');
let start = code.indexOf("msg.role === 'user'");
console.log(code.substring(start - 100, start + 500));
