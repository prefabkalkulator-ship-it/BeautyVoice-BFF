const fs = require('fs');
let code = fs.readFileSync('src/services/BookingService.ts', 'utf8');

// Update bookAppointment logic to accept promoCode and pass to db
code = code.replace(
  "export class BookingService {",
  "export class BookingService {\n  public async updateCustomerSource(tenantId: string, customerPhone: string, source: string): Promise<boolean> {\n    try {\n      const customer = await prisma.customer.findFirst({ where: { tenantId, phone: customerPhone } });\n      if (customer) {\n        await prisma.customer.update({ where: { id: customer.id }, data: { source } });\n        return true;\n      }\n      return false;\n    } catch (e) {\n      return false;\n    }\n  }"
);

const searchArgsBook = "public async bookAppointment(\n    tenantId: string,\n    serviceName: string,\n    customerName: string,\n    customerPhone: string,\n    startTime: string,\n    bookingMode: 'daily' | 'hourly',\n    preferredStaffName?: string,\n    durationMinutes: number = 60,\n    numberOfNights?: number\n  )";

const replaceArgsBook = "public async bookAppointment(\n    tenantId: string,\n    serviceName: string,\n    customerName: string,\n    customerPhone: string,\n    startTime: string,\n    bookingMode: 'daily' | 'hourly',\n    preferredStaffName?: string,\n    durationMinutes: number = 60,\n    numberOfNights?: number,\n    promoCode?: string\n  )";

code = code.replace(searchArgsBook, replaceArgsBook);

const searchCreate = `const createdAppt = await prisma.appointment.create({
        data: {
          tenantId,
          serviceId: service.id,
          staffId: assignedStaffId,
          customerId: customer.id,
          customerName,
          customerPhone,
          startTime: startDate,
          endTime: endDate,
          status: 'confirmed'
        }
      });`;

const replaceCreate = `const createdAppt = await prisma.appointment.create({
        data: {
          tenantId,
          serviceId: service.id,
          staffId: assignedStaffId,
          customerId: customer.id,
          customerName,
          customerPhone,
          startTime: startDate,
          endTime: endDate,
          status: 'confirmed',
          promoCode: promoCode || null
        }
      });`;

code = code.replace(searchCreate, replaceCreate);

fs.writeFileSync('src/services/BookingService.ts', code, 'utf8');
