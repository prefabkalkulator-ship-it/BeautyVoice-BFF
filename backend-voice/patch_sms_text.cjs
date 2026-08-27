const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');

const oldText = '`Przypomnienie: jutro masz wizytę o ${appt.startTime.toLocaleTimeString(\'pl-PL\', {hour:\'2-digit\', minute:\'2-digit\', timeZone:\'Europe/Warsaw\'})}. Odpisz TAK by potwierdzić, lub ANULUJ by zrezygnować.`';
const newText = '`Przypomnienie: masz zaplanowaną rezerwację na jutro (godz. ${appt.startTime.toLocaleTimeString(\'pl-PL\', {hour:\'2-digit\', minute:\'2-digit\', timeZone:\'Europe/Warsaw\'})}). Odpisz TAK by potwierdzić, lub ANULUJ by zrezygnować.`';

code = code.replace(oldText, newText);

fs.writeFileSync('src/app.ts', code, 'utf8');
