const fs = require('fs');
let content = fs.readFileSync('src/app.ts', 'utf8');
const search = 'export { app };';
const index = content.indexOf(search);
if (index !== -1) {
    content = content.substring(0, index + search.length);
    content += '\n\napp.post("/api/twilio-incoming", (req, res) => {\n  const host = req.headers.host;\n  res.type("text/xml");\n  res.send("<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?><Response><Connect><Stream url=\\"wss://" + host + "/api/twilio-voice\\" /></Connect></Response>");\n});\n';
    fs.writeFileSync('src/app.ts', content);
}
