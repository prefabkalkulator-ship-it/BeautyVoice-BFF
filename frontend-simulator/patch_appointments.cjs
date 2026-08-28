const fs = require('fs');
let code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');

const search = `            <div key={app.id} className="glass-card glass-card-hover rounded-xl p-4 relative overflow-hidden group">`;
const replace = `            <div key={app.id} className={\`glass-card glass-card-hover rounded-xl p-4 relative overflow-hidden group \${app.status === 'confirmed' ? 'border-2 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : ''}\`}>`;

code = code.replace(search, replace);
fs.writeFileSync('src/components/Appointments.tsx', code, 'utf8');
