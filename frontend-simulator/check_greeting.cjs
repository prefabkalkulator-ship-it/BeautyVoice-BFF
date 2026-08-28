const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');
const matches = [...code.matchAll(/Dzie. dobry! Z tej strony EVA/g)];
for (const match of matches) {
  const start = Math.max(0, match.index - 50);
  console.log(code.substring(start, start + 300));
  console.log('---');
}
