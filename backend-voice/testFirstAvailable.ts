import { prisma } from './src/prisma';
import { BookingService } from './src/services/BookingService';

const bookingService = new BookingService();

async function runTests() {
  console.log('=== Rozpoczynam testy First Available ===');
  
  const tenant = await prisma.tenant.create({
    data: { name: 'Testowy Salon', phoneNumber: 'test-123456', businessProfile: 'team' }
  });

  const service = await prisma.service.create({
    data: { tenantId: tenant.id, name: 'Strzyzenie Testowe', price: 50, durationMinutes: 60 }
  });

  const staff1 = await prisma.staffMember.create({ data: { tenantId: tenant.id, name: 'Fryzjer A', role: 'Stylista' } });
  const staff2 = await prisma.staffMember.create({ data: { tenantId: tenant.id, name: 'Fryzjer B', role: 'Stylista' } });

  await prisma.staffService.createMany({
    data: [
      { staffId: staff1.id, serviceId: service.id },
      { staffId: staff2.id, serviceId: service.id }
    ]
  });

  const date = '2026-08-20';

  try {
    console.log('Rezerwacja #1...');
    await bookingService.bookAppointment(tenant.id, 'Klient 1', '111', 'Strzyzenie Testowe', `${date}T10:00:00+02:00`, 60);
    
    const slots = await bookingService.checkAvailability(tenant.id, date, 'Strzyzenie Testowe', 60);
    console.log('Dostepne sloty po Rezerwacji #1 (oczekiwane 10:00 dostepne):', slots.includes('10:00'));

    console.log('Rezerwacja #2...');
    await bookingService.bookAppointment(tenant.id, 'Klient 2', '222', 'Strzyzenie Testowe', `${date}T10:00:00+02:00`, 60);

    const slots2 = await bookingService.checkAvailability(tenant.id, date, 'Strzyzenie Testowe', 60);
    console.log('Dostepne sloty po Rezerwacji #2 (oczekiwane 10:00 zablokowane):', !slots2.includes('10:00'));

    console.log('Rezerwacja #3 (oczekujemy bledu)...');
    let errorThrown = false;
    try {
      await bookingService.bookAppointment(tenant.id, 'Klient 3', '333', 'Strzyzenie Testowe', `${date}T10:00:00+02:00`, 60);
    } catch (err: any) {
      errorThrown = true;
      console.log('Otrzymano oczekiwany blad:', err.message);
    }
    
    if (!errorThrown) throw new Error('OVERBOOKING!');

    console.log('=== Testy ZAKONCZONE SUKCESEM ===');

  } catch (error) {
    console.error('Testy nie powiodly sie:', error);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
  }
}

runTests();
