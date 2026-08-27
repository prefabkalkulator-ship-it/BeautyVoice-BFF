const fs = require('fs');
let code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');

const searchListView = `                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 uppercase tracking-wide">
                    {app.status}
                  </span>`;

const replaceListView = `                  <span className={\`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide \${app.status === 'confirmed_by_client' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-surface-50 text-surface-600 border-surface-200'}\`}>
                    {app.status === 'confirmed_by_client' ? 'Potwierdzony' : app.status}
                  </span>
                  {app.promoCode && (
                    <span className="inline-flex items-center ml-2 text-red-500" title={\`Rabat: \${app.promoCode}\`}>
                      <Gift className="w-4 h-4" />
                    </span>
                  )}`;

code = code.replace(searchListView, replaceListView);

fs.writeFileSync('src/components/Appointments.tsx', code, 'utf8');
