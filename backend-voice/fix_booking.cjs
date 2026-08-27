const fs = require('fs');
let code = fs.readFileSync('src/services/BookingService.ts', 'utf8');

const search = `public async bookAppointment(
    tenantId: string,
    customerName: string,
    customerPhone: string,
    serviceName: string,
    startTime: string,
    durationMinutes: number,
    preferredStaffName?: string,
    bookingMode: string = "hourly",
    numberOfNights?: number
  ): Promise<boolean> {`;

const replace = `public async bookAppointment(
    tenantId: string,
    customerName: string,
    customerPhone: string,
    serviceName: string,
    startTime: string,
    durationMinutes: number,
    preferredStaffName?: string,
    bookingMode: string = "hourly",
    numberOfNights?: number,
    promoCode?: string
  ): Promise<boolean> {`;

code = code.replace(search, replace);

fs.writeFileSync('src/services/BookingService.ts', code, 'utf8');
