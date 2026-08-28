const fs = require('fs');
let code = fs.readFileSync('src/services/voice/VoiceOutboundService.ts', 'utf8');

const search = `      const response = await api.call('/v1/request/callback/', {
        from: this.zadarmaFrom,
        to: targetPhone
      }, 'POST');`;

const replace = `      const response = await api.call('/v1/request/callback/', {
        from: this.zadarmaFrom,
        to: targetPhone
      }, 'GET');`;

code = code.replace(search, replace);
fs.writeFileSync('src/services/voice/VoiceOutboundService.ts', code, 'utf8');
