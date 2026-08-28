const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');
let start = code.indexOf("const handleSendDirect");
console.log(code.substring(start, start + 800));
