const fs = require('fs');
let code = fs.readFileSync('src/services/voice/VoiceOutboundService.ts', 'utf8');

const search = `        const from = this.callerId.startsWith('+') ? this.callerId : '+' + this.callerId;`;
const replace = `        const from = process.env.TWILIO_CALLER_ID || '+48533989987';`;

code = code.replace(search, replace);
fs.writeFileSync('src/services/voice/VoiceOutboundService.ts', code, 'utf8');
