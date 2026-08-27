const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

// Find the textarea renderer
const searchRender = "textarea value={val} onChange={e => updateActionCardArg(msg.id, k, e.target.value)} rows={k === 'message_content' ? 3 : 1} className=";
const replaceRender = "textarea value={val} onChange={e => updateActionCardArg(msg.id, k, e.target.value)} rows={k === 'message_content' ? 4 : (k === 'campaign_name' ? 2 : 1)} className=";

code = code.replace(searchRender, replaceRender);

fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
