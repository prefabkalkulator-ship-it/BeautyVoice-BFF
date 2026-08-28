const fs = require('fs');
let code = fs.readFileSync('src/services/voice/VoiceOutboundService.ts', 'utf8');

const search = `      const response = await api.api({
        method: '/v1/request/callback/',
        params: {
          from: this.zadarmaFrom,
          to: targetPhone
        }
      });`;

const replace = `      const response = await api.call('/v1/request/callback/', {
        from: this.zadarmaFrom,
        to: targetPhone
      }, 'POST');`;

code = code.replace(search, replace);
fs.writeFileSync('src/services/voice/VoiceOutboundService.ts', code, 'utf8');
