const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

code = code.replace(/'Dzień dobry![\s\S]*?SMSem"'/g, "`Dzień dobry! Z tej strony EVA, wirtualna asystentka. W czym mogę pomóc?\n\nPrzykładowe komendy:\n• \"Wyślij przypomnienie z 10% rabatu do klientów z tagiem #lojalny, kanał sms\"\n• \"Uruchom potwierdzanie jutrzejszych rezerwacji SMSem\"`");

fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
