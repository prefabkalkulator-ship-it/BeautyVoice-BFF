const fs = require('fs');
let code = fs.readFileSync('src/components/AppointmentsDaily.tsx', 'utf8');

code = code.replace(
  "status: string;\n  promoCode?: string;",
  "status: string;\n  promoCode?: string;\n  npsScore?: number;"
);

code = code.replace(
  "{app.promoCode && <Gift className=\"w-3 h-3 text-red-100\" title=\"Z kodem rabatowym\" />}",
  "{app.promoCode && <Gift className=\"w-3 h-3 text-red-100\" title=\"Z kodem rabatowym\" />}\n                            {app.npsScore && <span className=\"ml-1 flex items-center text-[10px] text-yellow-300\" title=\"Ocena NPS\"><Star className=\"w-2.5 h-2.5 mr-0.5\"/>{app.npsScore}</span>}"
);

code = code.replace(
  "Potwierdzone przez klienta (SMS/Głos)\n                    </div>\n                  )}",
  "Potwierdzone przez klienta (SMS/Głos)\n                    </div>\n                  )}\n                  {selectedAppt?.npsScore && (\n                    <div className=\"flex items-center gap-2 text-yellow-700 font-medium\">\n                      <Star className=\"w-5 h-5 text-yellow-500 fill-yellow-500\" />\n                      Ocena klienta: {selectedAppt.npsScore} / 5\n                    </div>\n                  )}"
);

code = code.replace(
  "import {  Calendar, ChevronLeft, ChevronRight, Edit2, X, Save , Plus, Gift, CheckCircle, Tag, User, Phone, Clock } from 'lucide-react';",
  "import {  Calendar, ChevronLeft, ChevronRight, Edit2, X, Save , Plus, Gift, CheckCircle, Tag, User, Phone, Clock, Star } from 'lucide-react';"
);

fs.writeFileSync('src/components/AppointmentsDaily.tsx', code, 'utf8');
