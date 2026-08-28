const fs = require('fs');
let code = fs.readFileSync('src/components/AppointmentsDaily.tsx', 'utf8');

const searchScroll = `export default function AppointmentsDaily({ appointments, services, staffList, loadData, loading }: any) {
  const [currentDate, setCurrentDate] = useState(new Date());`;
  
const replaceScroll = `export default function AppointmentsDaily({ appointments, services, staffList, loadData, loading }: any) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Automatyczne przewijanie do 'wczoraj' po załadowaniu lub zmianie miesiąca
    if (scrollRef.current) {
      const today = new Date();
      if (today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()) {
        const currentDay = today.getDate();
        // Chcemy widzieć wczoraj, dzisiaj, jutro. Wczoraj to (currentDay - 1). 
        // 1 dzień to 48px (w-12). Zostawiamy mały margines, np. 2 dni wcześniej = (currentDay - 3)
        const targetDay = Math.max(1, currentDay - 2); 
        const scrollAmount = (targetDay - 1) * 48; // w-12 = 48px
        scrollRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
      } else {
        // Inny miesiąc, scroll na początek
        scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      }
    }
  }, [currentDate.getMonth(), currentDate.getFullYear(), loading]);`;

code = code.replace(searchScroll, replaceScroll);

const searchDiv = `<div className="overflow-x-auto pb-4">`;
const replaceDiv = `<div className="overflow-x-auto pb-4" ref={scrollRef}>`;

code = code.replace(searchDiv, replaceDiv);

// we need to make sure React is imported, wait, let's see imports.
const searchImports = `import { useState } from 'react';`;
const replaceImports = `import React, { useState } from 'react';`;
code = code.replace(searchImports, replaceImports);

fs.writeFileSync('src/components/AppointmentsDaily.tsx', code, 'utf8');
