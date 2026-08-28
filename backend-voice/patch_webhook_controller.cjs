const fs = require('fs');
let code = fs.readFileSync('src/controllers/WebhookController.ts', 'utf8');

const search = `      console.log('🤖 Odpowiedź asystenta:', reply);

      res.status(200).json({
        reply: reply,
      });`;

const replace = `      console.log('🤖 Odpowiedź asystenta:', reply);
      
      let finalReply = reply;
      let actionCard = undefined;

      try {
        if (reply.includes('_isActionCard')) {
          const parsed = JSON.parse(reply);
          if (parsed._isActionCard) {
            actionCard = {
              toolName: parsed.toolName,
              args: parsed.args
            };
            finalReply = ''; // Pusty tekst, UI wyrenderuje kartę
          }
        }
      } catch(e) {}

      res.status(200).json({
        reply: finalReply,
        actionCard: actionCard
      });`;

code = code.replace(search, replace);
fs.writeFileSync('src/controllers/WebhookController.ts', code, 'utf8');
