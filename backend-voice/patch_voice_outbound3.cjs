const fs = require('fs');
let code = fs.readFileSync('src/services/voice/VoiceOutboundService.ts', 'utf8');

const search = `from: this.zadarmaFrom,`;
const replace = `from: this.zadarmaFrom.startsWith('+') ? this.zadarmaFrom : '+' + this.zadarmaFrom,`;

code = code.replace(search, replace);
fs.writeFileSync('src/services/voice/VoiceOutboundService.ts', code, 'utf8');
