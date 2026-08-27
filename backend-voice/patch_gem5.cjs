const fs = require('fs');
let code = fs.readFileSync('src/services/GeminiService.ts', 'utf8');

const correctBook = `} else if (name === 'bookAppointment') {
              const success = await bookingService.bookAppointment(
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
              );
              toolResult = { success };
            } else if (name === 'updateCustomerSource') {
              const success = await bookingService.updateCustomerSource(tenantId, args.customerPhone, args.source);
              toolResult = { success };
            }
          } catch (err: any) {`;

code = code.replace(/} else if \(name === 'bookAppointment'\) {[\s\S]*?} catch \(err: any\) {/, correctBook);

fs.writeFileSync('src/services/GeminiService.ts', code, 'utf8');
