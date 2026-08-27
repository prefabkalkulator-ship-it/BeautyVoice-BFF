const fs = require('fs');
let code = fs.readFileSync('src/components/Appointments.tsx', 'utf8');

code = code.replace(
  "import { Calendar, Clock, User, Phone, Plus, ChevronLeft, ChevronRight, List, Grid, X, Tag } from 'lucide-react';",
  "import { Calendar, Clock, User, Phone, Plus, ChevronLeft, ChevronRight, List, Grid, X, Tag, Gift, CheckCircle } from 'lucide-react';"
);

code = code.replace(
  "status: string;",
  "status: string;\n  promoCode?: string;"
);

fs.writeFileSync('src/components/Appointments.tsx', code, 'utf8');
