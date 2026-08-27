const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');

const searchMsg = 'Przepraszamy, ale ten termin został już przed chwilą zarezerwowany. Zapraszamy do rezerwacji innych wolnych dat na naszej stronie!';
const replaceMsg = 'Przepraszamy, ale ten termin został już przed chwilą zarezerwowany. Zapraszamy do rezerwacji innych wolnych dat!';

code = code.replace(searchMsg, replaceMsg);

fs.writeFileSync('src/app.ts', code, 'utf8');
