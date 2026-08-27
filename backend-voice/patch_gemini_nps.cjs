const fs = require('fs');
let code = fs.readFileSync('src/services/GeminiService.ts', 'utf8');

const searchTool = `      {
        name: 'updateCustomerSource',`;
const replaceTool = `      {
        name: 'save_nps_score',
        description: 'Zapisz ocenę klienta po wizycie (NPS).',
        parameters: {
          type: 'object',
          properties: {
            customerPhone: { type: 'string' },
            score: { type: 'number', description: 'Ocena od 1 do 5' }
          },
          required: ['customerPhone', 'score']
        }
      },
      {
        name: 'updateCustomerSource',`;

code = code.replace(searchTool, replaceTool);

const searchExecute = `} else if (name === 'updateCustomerSource') {`;
const replaceExecute = `} else if (name === 'save_nps_score') {
              const success = await bookingService.saveNpsScore(tenantId, args.customerPhone, args.score);
              toolResult = { success };
            } else if (name === 'updateCustomerSource') {`;

code = code.replace(searchExecute, replaceExecute);

const searchIntercept = `if (name === 'create_informational_campaign' || name === 'schedule_confirmation_flow' || name === 'create_last_minute_offer') {`;
const replaceIntercept = `if (name === 'create_informational_campaign' || name === 'schedule_confirmation_flow' || name === 'create_last_minute_offer' || name === 'send_nps_surveys') {`;

code = code.replace(searchIntercept, replaceIntercept);

const searchNpsTool = `      {
        name: 'create_last_minute_offer',`;
const replaceNpsTool = `      {
        name: 'send_nps_surveys',
        description: 'Wysyła ankiety badania satysfakcji klientów (NPS) do osób, które odbyły wizytę wczoraj.',
        parameters: {
          type: 'object',
          properties: {
            target_scope: { type: 'string', enum: ['yesterday'] }
          },
          required: ['target_scope']
        }
      },
      {
        name: 'create_last_minute_offer',`;

code = code.replace(searchNpsTool, replaceNpsTool);

fs.writeFileSync('src/services/GeminiService.ts', code, 'utf8');
