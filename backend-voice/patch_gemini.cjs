const fs = require('fs');
let code = fs.readFileSync('src/services/GeminiService.ts', 'utf8');

code = code.replace(
  "if (name === 'create_informational_campaign' || name === 'schedule_confirmation_flow') {",
  "if (name === 'create_informational_campaign' || name === 'schedule_confirmation_flow' || name === 'create_last_minute_offer') {"
);

fs.writeFileSync('src/services/GeminiService.ts', code, 'utf8');
