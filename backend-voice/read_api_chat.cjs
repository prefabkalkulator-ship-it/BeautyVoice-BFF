const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');
let start = code.indexOf("app.post(\"/api/chat\"");
console.log(code.substring(start, start + 500));
