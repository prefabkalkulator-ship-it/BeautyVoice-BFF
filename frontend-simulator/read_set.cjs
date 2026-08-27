const fs = require('fs');
let code = fs.readFileSync('src/components/Settings.tsx', 'utf8');
let start = code.indexOf("botName");
console.log(code.substring(start - 100, start + 300));
