const fs = require('fs');
let code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');

const searchTile = `                          const bgColor = getColorCode(app.service?.id || '');

                          return (
                            <div 
                              key={app.id} 
                              onClick={(e) => { e.stopPropagation(); openEditModal(app); }}
                              style={{ top: \`\${topPx}px\`, height: \`\${heightPx}px\` }}
                              className={\`absolute left-1 right-2 z-10 \${bgColor} text-white p-2 rounded-xl shadow-md flex flex-col overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer\`}
                            >
                              <span className="font-semibold text-xs truncate drop-shadow-sm">{app.customerName}</span>`;

const replaceTile = `                          const bgColor = getColorCode(app.service?.id || '');
                          const isConfirmedByClient = app.status === 'confirmed_by_client';
                          const hasPromo = !!app.promoCode;

                          return (
                            <div 
                              key={app.id} 
                              onClick={(e) => { e.stopPropagation(); openEditModal(app); }}
                              style={{ top: \`\${topPx}px\`, height: \`\${heightPx}px\` }}
                              className={\`absolute left-1 right-2 z-10 \${bgColor} text-white p-2 rounded-xl shadow-md flex flex-col overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer \${isConfirmedByClient ? 'ring-2 ring-green-400 border-2 border-green-500' : 'border border-transparent'}\`}
                            >
                              <span className="font-semibold text-xs truncate drop-shadow-sm flex items-center gap-1">
                                {app.customerName}
                                {hasPromo && <Gift className="w-3 h-3 text-yellow-300 ml-1" title="Z kodem rabatowym" />}
                              </span>`;

code = code.replace(searchTile, replaceTile);

fs.writeFileSync('src/components/Appointments.tsx', code, 'utf8');
