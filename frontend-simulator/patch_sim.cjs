const fs = require('fs');
let code = fs.readFileSync('src/components/Simulator.tsx', 'utf8');

code = code.replace(
  "toolName === 'create_informational_campaign' ? 'Nowa Kampania' : 'Weryfikacja Rezerwacji'",
  "toolName === 'create_informational_campaign' ? 'Nowa Kampania' : ((msg as any).actionCard.toolName === 'create_last_minute_offer' ? 'Oferta Last Minute' : 'Weryfikacja Rezerwacji')"
);

// We should also map target_datetime key.
const keyMapRegex = /target_scope: 'Zakres rezerwacji',\s*confirmation_method: 'Metoda potwierdzania'/;
code = code.replace(keyMapRegex, "target_scope: 'Zakres rezerwacji',\n  confirmation_method: 'Metoda potwierdzania',\n  target_datetime: 'Termin okienka'");

fs.writeFileSync('src/components/Simulator.tsx', code, 'utf8');
