const fs = require('fs');
let code = fs.readFileSync('src/services/GeminiService.ts', 'utf8');

const injection = `
            if (name === 'create_informational_campaign' || name === 'schedule_confirmation_flow') {
              return JSON.stringify({
                _isActionCard: true,
                toolName: name,
                args: args
              });
            }
`;

code = code.replace(
  'try {\n            if (name === \'getServicesAndPrices\') {',
  'try {\n' + injection + '            if (name === \'getServicesAndPrices\') {'
);

fs.writeFileSync('src/services/GeminiService.ts', code, 'utf8');
