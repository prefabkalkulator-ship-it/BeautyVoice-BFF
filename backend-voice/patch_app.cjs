const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');

code = code.replace(
  "import { knowledgeService } from './services/KnowledgeExtractorService';",
  "import { knowledgeService } from './services/KnowledgeExtractorService';\nimport { VoiceOutboundService } from './services/voice/VoiceOutboundService';"
);

const searchTwilio = `  res.type("text/xml");
  res.send(\`<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://\${host}/api/twilio-voice"><Parameter name="callerPhone" value="\${callerPhone}" /><Parameter name="dialedNumber" value="\${calledNumber}" /></Stream></Connect></Response>\`);
});`;

const replaceTwilio = `  // Wykrywanie czy to jest Zadarma Callback (Outbound) - szukamy obu numerów w cache (Twilio może podać numer klienta w From lub To zależnie od konfiguracji pbx)
  let outboundTaskId = VoiceOutboundService.getTaskIdByPhone(callerPhone);
  if (!outboundTaskId) {
    outboundTaskId = VoiceOutboundService.getTaskIdByPhone(calledNumber);
  }

  // W TwiML dodajemy opcjonalny parametr outboundTaskId
  const outboundParam = outboundTaskId ? \`<Parameter name="outboundTaskId" value="\${outboundTaskId}" />\` : '';

  res.type("text/xml");
  res.send(\`<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://\${host}/api/twilio-voice"><Parameter name="callerPhone" value="\${callerPhone}" /><Parameter name="dialedNumber" value="\${calledNumber}" />\${outboundParam}</Stream></Connect></Response>\`);
});`;

code = code.replace(searchTwilio, replaceTwilio);

fs.writeFileSync('src/app.ts', code, 'utf8');
