const fs = require('fs');
let code = fs.readFileSync('src/components/AppointmentsDaily.tsx', 'utf8');

const search = `                        className="absolute top-2 bottom-2 rounded-lg bg-gold-500 text-white shadow-md border border-gold-600 flex flex-col p-1.5 overflow-hidden cursor-pointer hover:bg-gold-600 hover:scale-[1.02] transition-all z-20"
                        style={{ left: \`\${leftPx}px\`, width: \`\${widthPx}px\` }}`;

const replace = `                        className={\`absolute top-2 bottom-2 rounded-lg shadow-md border flex flex-col p-1.5 overflow-hidden cursor-pointer hover:scale-[1.02] transition-all z-20 \${
                          app.status === 'confirmed' 
                            ? 'bg-gold-500 text-white border-4 border-green-500 hover:bg-gold-600' 
                            : 'bg-gold-500 text-white border border-gold-600 hover:bg-gold-600'
                        }\`}
                        style={{ left: \`\${leftPx}px\`, width: \`\${widthPx}px\` }}`;

code = code.replace(search, replace);
fs.writeFileSync('src/components/AppointmentsDaily.tsx', code, 'utf8');
