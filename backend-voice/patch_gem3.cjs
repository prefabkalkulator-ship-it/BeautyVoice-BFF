const fs = require('fs');
let code = fs.readFileSync('src/services/GeminiService.ts', 'utf8');

const searchBook = `              const success = await bookingService.bookAppointment(
                tenantId,
                args.customerName,
                args.customerPhone,
                args.serviceName,
                args.startTime,
                args.durationMinutes,
                args.preferredStaffName
              );`;

const replaceBook = `              const success = await bookingService.bookAppointment(
                tenantId,
                args.serviceName,
                args.customerName,
                args.customerPhone,
                args.startTime,
                args.numberOfNights ? 'daily' : 'hourly',
                args.preferredStaffName,
                args.durationMinutes,
                args.numberOfNights,
                args.promoCode
              );`;

code = code.replace(searchBook, replaceBook);

const newToolHandler = `
            } else if (name === 'updateCustomerSource') {
              const success = await bookingService.updateCustomerSource(tenantId, args.customerPhone, args.source);
              toolResult = { success };
`;

code = code.replace("} catch (err: any) {", newToolHandler + "            } catch (err: any) {");

fs.writeFileSync('src/services/GeminiService.ts', code, 'utf8');
