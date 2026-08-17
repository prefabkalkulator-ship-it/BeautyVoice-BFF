import { prisma } from '../prisma';

export interface ServiceItem {
  id: string;
  name: string;
  price: string;
  durationMinutes: number;
}

export class BookingService {
  /**
   * Schematy narzędzi (Function Calling) dla Gemini
   */
  public static getToolDefinitions() {
    return [
      {
        name: 'getServicesAndPrices',
        description: 'Pobiera aktualną listę usług salonu, ich ceny oraz czas trwania.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'checkAvailability',
        description: 'Sprawdza dostępne godziny na wizytę w danym dniu.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date: {
              type: 'STRING',
              description: 'Data w formacie YYYY-MM-DD',
            },
            durationMinutes: {
              type: 'INTEGER',
              description: 'Czas trwania usługi w minutach',
            },
          },
          required: ['date', 'durationMinutes'],
        },
      },
      {
        name: 'getFAQ',
        description: 'Pobiera listę najczęściej zadawanych pytań (FAQ) i odpowiedzi z bazy wiedzy salonu.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'bookAppointment',
        description: 'Rezerwuje wizytę dla klienta w systemie.',
        parameters: {
          type: 'OBJECT',
          properties: {
            customerName: {
              type: 'STRING',
              description: 'Imię klienta',
            },
            customerPhone: {
              type: 'STRING',
              description: 'Numer telefonu klienta',
            },
            serviceName: {
              type: 'STRING',
              description: 'Nazwa wybranej usługi',
            },
            startTime: {
              type: 'STRING',
              description: 'Data i godzina rozpoczęcia wizyty w lokalnej strefie czasowej (np. 2024-05-20T14:30:00+02:00)',
            },
            durationMinutes: {
              type: 'INTEGER',
              description: 'Czas trwania usługi w minutach',
            },
          },
          required: ['customerName', 'customerPhone', 'serviceName', 'startTime', 'durationMinutes'],
        },
      },
    ];
  }

  /**
   * 1. Pobiera usługi i ceny z bazy danych dla konkretnego najemcy
   */
  public async getServicesAndPrices(tenantId: string): Promise<ServiceItem[]> {
    try {
      const services = await prisma.service.findMany({
        where: { tenantId }
      });
      
      return services.map(s => ({
        id: s.id,
        name: s.name,
        price: s.price.toString(),
        durationMinutes: s.durationMinutes,
      }));
    } catch (error) {
      console.error('Błąd pobierania cennika z DB:', error);
      throw new Error('Nie udało się pobrać cennika z bazy danych.');
    }
  }

  /**
   * 2. Sprawdza wolne terminy w bazie danych na podstawie zapisanych rezerwacji
   */
  public async checkAvailability(tenantId: string, date: string, durationMinutes: number): Promise<string[]> {
    try {
      const timeMin = new Date(`${date}T08:00:00+02:00`);
      const timeMax = new Date(`${date}T18:00:00+02:00`); // Godziny pracy np. 8:00-18:00

      // Pobieramy rezerwacje w tym dniu dla danego tenanta
      const appointments = await prisma.appointment.findMany({
        where: {
          tenantId,
          startTime: {
            gte: timeMin,
            lt: timeMax,
          },
          status: 'confirmed'
        },
        orderBy: {
          startTime: 'asc'
        }
      });

      const bookedIntervals = appointments.map(app => ({
        start: app.startTime.getTime(),
        end: app.endTime.getTime()
      }));

      const availableSlots: string[] = [];
      const slotStepMs = 30 * 60000; 
      let currentSlot = timeMin.getTime();

      while (currentSlot + (durationMinutes * 60000) <= timeMax.getTime()) {
        const slotEnd = currentSlot + (durationMinutes * 60000);
        
        const hasConflict = bookedIntervals.some(interval => {
          return (currentSlot < interval.end && slotEnd > interval.start);
        });

        if (!hasConflict) {
          const slotDate = new Date(currentSlot);
          const hours = slotDate.getHours().toString().padStart(2, '0');
          const minutes = slotDate.getMinutes().toString().padStart(2, '0');
          availableSlots.push(`${hours}:${minutes}`);
        }

        currentSlot += slotStepMs;
      }
      
      return availableSlots;
    } catch (error) {
      console.error('Błąd sprawdzania kalendarza DB:', error);
      throw new Error('Nie udało się sprawdzić dostępności.');
    }
  }

  /**
   * Pobiera sekcję FAQ z bazy danych
   */
  public async getFAQ(tenantId: string): Promise<{ question: string, answer: string }[]> {
    try {
      const faqs = await prisma.faqEntry.findMany({
        where: { tenantId }
      });
      return faqs.map(f => ({ question: f.question, answer: f.answer }));
    } catch (error) {
      console.error('Błąd pobierania FAQ z DB:', error);
      return []; 
    }
  }

  /**
   * 3. Rezerwuje wizytę: dodaje do tabeli Appointment w bazie danych
   */
  public async bookAppointment(
    tenantId: string,
    customerName: string,
    customerPhone: string,
    serviceName: string,
    startTime: string,
    durationMinutes: number
  ): Promise<boolean> {
    try {
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      // Najpierw musimy znaleźć ID usługi po nazwie (Gemini podaje nazwę)
      const service = await prisma.service.findFirst({
        where: { 
          tenantId,
          name: serviceName
        }
      });

      if (!service) {
        throw new Error(`Usługa o nazwie ${serviceName} nie została znaleziona.`);
      }

      // Idempotentność: sprawdzamy czy istnieje już taka rezerwacja (Vapi potrafi ponowić żądanie w przypadku timeoutu)
      const existingAppointment = await prisma.appointment.findFirst({
        where: {
          tenantId,
          customerPhone,
          serviceId: service.id,
          startTime: startDate
        }
      });

      if (existingAppointment) {
        console.log(`Rezerwacja dla ${customerPhone} na ${startTime} już istnieje.`);
        return true; // Zwracamy true, bo rezerwacja już się powiodła wcześniej
      }

      await prisma.appointment.create({
        data: {
          tenantId,
          serviceId: service.id,
          customerName,
          customerPhone,
          startTime: startDate,
          endTime: endDate,
          status: 'confirmed'
        }
      });

      return true;
    } catch (error) {
      console.error('Błąd rezerwacji DB:', error);
      throw new Error('Wystąpił problem podczas próby zapisania wizyty.');
    }
  }
}

export const bookingService = new BookingService();
