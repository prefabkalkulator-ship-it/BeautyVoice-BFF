const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');
let start = code.indexOf("app.post(\"/api/twilio-incoming\"");
let end = code.indexOf("});", start + 300);
console.log(code.substring(start, end + 3));
