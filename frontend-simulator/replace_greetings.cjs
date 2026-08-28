const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

const oldMsg1 = `Dzień dobry! Z tej strony EVA, wirtualna asystentka. W czym mogę pomóc?\\n\\nPrzykładowe komendy:\\n• \\"Wyślij przypomnienie z 10% rabatu do klientów z tagiem #lojalny, kanał sms\\"\\n• \\"Uruchom potwierdzanie jutrzejszych rezerwacji SMSem\\"`;
const newMsg = `Dzień dobry! Z tej strony EVA. Użyj poniższych przycisków, by uruchomić gotowe kampanie, lub po prostu napisz do mnie, co chcesz osiągnąć.`;

code = code.replace(/Dzień dobry! Z tej strony EVA, wirtualna asystentka\. W czym mogę pomóc\?\\n\\nPrzykładowe komendy:\\n• \\"Wyślij przypomnienie z 10% rabatu do klientów z tagiem #lojalny, kanał sms\\"\\n• \\"Uruchom potwierdzanie jutrzejszych rezerwacji SMSem\\"/g, newMsg);

// Also handle the raw string if the regex didn't catch it because of newlines
code = code.replace(/Dzie. dobry! Z tej strony EVA, wirtualna asystentka\. W czym mog. pom.c\?\n\nPrzyk.adowe komendy:\n. "Wy.lij przypomnienie z 10% rabatu do klient.w z tagiem #lojalny, kana. sms"\n. "Uruchom potwierdzanie jutrzejszych rezerwacji SMSem"/g, newMsg);

fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
