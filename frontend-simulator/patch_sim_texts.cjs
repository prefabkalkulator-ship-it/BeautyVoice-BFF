const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

code = code.replace(/Wizyty z jutra/g, 'Rezerwacje z jutra');
code = code.replace(/Potwierdź jutrzejsze wizyty sms-em/g, 'Potwierdź jutrzejsze rezerwacje sms-em');
code = code.replace(/Potwierdź wizyty/g, 'Potwierdź rezerwacje');

fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
