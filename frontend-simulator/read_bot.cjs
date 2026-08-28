const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');
let start = code.indexOf("<Bot size={14} />");
console.log(code.substring(start - 100, start + 300));
