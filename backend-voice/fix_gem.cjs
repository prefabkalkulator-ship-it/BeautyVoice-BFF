const fs = require('fs');
let code = fs.readFileSync('src/services/GeminiService.ts', 'utf8');

const search = `              const success = await bookingService.bookAppointment(
                tenantId,
                args.serviceName,
                args.customerName,
                args.customerPhone,
                args.startTime,
                'hourly',
                args.preferredStaffName,
                args.durationMinutes,
                undefined,
                args.promoCode
              );`;

const replace = `              const success = await bookingService.bookAppointment(
                tenantId,
                args.customerName,
                args.customerPhone,
                args.serviceName,
                args.startTime,
                args.durationMinutes,
                args.preferredStaffName,
                'hourly',
                undefined,
                args.promoCode
              );`;

code = code.replace(search, replace);

fs.writeFileSync('src/services/GeminiService.ts', code, 'utf8');
