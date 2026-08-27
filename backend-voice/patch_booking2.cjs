const fs = require('fs');
let code = fs.readFileSync('src/services/BookingService.ts', 'utf8');

// Add updateCustomerSource to tools
const newTool = `
          {
            name: 'updateCustomerSource',
            description: 'Używaj TEGO narztdzia wycznie wtedy, gdy zapytasz nowego klienta "Skd si o nas dowiedziae?" a on odpowie (np. z Google, od znajomego, z Facebooka).',
            parameters: {
              type: 'OBJECT',
              properties: {
                customerPhone: { type: 'STRING', description: 'Numer telefonu klienta' },
                source: { type: 'STRING', description: 'Źrdo pozyskania klienta (np. Google, Facebook, polecenie, ulotka)' }
              },
              required: ['customerPhone', 'source']
            }
          },
`;

code = code.replace(
  /{[\s]*name:\s*'create_informational_campaign'/,
  newTool + "          {\n            name: 'create_informational_campaign'"
);

// Add promoCode to bookAppointment tool
const oldParamsBook = `customerPhone: { type: 'STRING', description: 'Numer telefonu z kierunkowym (np. +48123456789)' },
                startTime: { type: 'STRING', description: 'Data i czas ISO z checkAvailability' },`;

const newParamsBook = `customerPhone: { type: 'STRING', description: 'Numer telefonu z kierunkowym (np. +48123456789)' },
                promoCode: { type: 'STRING', description: 'Opcjonalny kod rabatowy podany przez klienta (np. WEEKEND10)' },
                startTime: { type: 'STRING', description: 'Data i czas ISO z checkAvailability' },`;

code = code.replace(oldParamsBook, newParamsBook);

fs.writeFileSync('src/services/BookingService.ts', code, 'utf8');
