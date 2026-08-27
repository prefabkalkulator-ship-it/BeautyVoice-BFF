const fs = require('fs');
let code = fs.readFileSync('src/components/AppointmentsDaily.tsx', 'utf8');

code = code.replace(
  "import {  Calendar, ChevronLeft, ChevronRight, Edit2, X, Save , Plus } from 'lucide-react';",
  "import {  Calendar, ChevronLeft, ChevronRight, Edit2, X, Save , Plus, Gift, CheckCircle, Tag, User, Phone, Clock } from 'lucide-react';"
);

code = code.replace(
  "status: string;",
  "status: string;\n  promoCode?: string;"
);

const searchTile = `                          onClick={(e) => { e.stopPropagation(); openEditModal(app); }}
                          className="absolute top-2 bottom-2 rounded-lg bg-gold-500 text-white shadow-md border border-gold-600 flex flex-col p-1.5 overflow-hidden cursor-pointer hover:bg-gold-600 hover:scale-[1.02] transition-all z-20"
                          style={{ left: \`\${leftPx}px\`, width: \`\${widthPx}px\` }}
                        >
                          <div className="font-semibold text-[11px] truncate leading-tight drop-shadow-sm">{app.customerName}</div>`;

const replaceTile = `                          onClick={(e) => { e.stopPropagation(); openEditModal(app); }}
                          className={\`absolute top-2 bottom-2 rounded-lg bg-gold-500 text-white shadow-md flex flex-col p-1.5 overflow-hidden cursor-pointer hover:bg-gold-600 hover:scale-[1.02] transition-all z-20 \${app.status === 'confirmed_by_client' ? 'ring-2 ring-green-400 border-2 border-green-500' : 'border border-gold-600'}\`}
                          style={{ left: \`\${leftPx}px\`, width: \`\${widthPx}px\` }}
                        >
                          <div className="font-semibold text-[11px] truncate leading-tight drop-shadow-sm flex items-center gap-1">
                            {app.customerName}
                            {app.promoCode && <Gift className="w-3 h-3 text-red-100" title="Z kodem rabatowym" />}
                          </div>`;

code = code.replace(searchTile, replaceTile);

fs.writeFileSync('src/components/AppointmentsDaily.tsx', code, 'utf8');
