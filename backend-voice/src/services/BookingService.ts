import { SMSService } from './sms/SMSService';
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
        description: 'Sprawdza dostępne godziny na wizytę w danym dniu dla wybranej usługi (uwzględniając dostępność personelu).',
        parameters: {
          type: 'OBJECT',
          properties: {
            date: {
              type: 'STRING',
              description: 'Data w formacie YYYY-MM-DD',
            },
            serviceName: {
              type: 'STRING',
              description: 'Nazwa wybranej usługi',
            },
            durationMinutes: {
              type: 'INTEGER',
              description: 'Czas trwania usługi w minutach',
            },
            preferredStaffName: {
              type: 'STRING',
              description: 'Imię preferowanego pracownika (opcjonalne)',
            },
          },
          required: ['date', 'serviceName', 'durationMinutes'],
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
            preferredStaffName: {
              type: 'STRING',
              description: 'Imię preferowanego pracownika (opcjonalne)',
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
  public async checkAvailability(tenantId: string, date: string, serviceName: string, durationMinutes: number, preferredStaffName?: string): Promise<string[]> {
    try {
      const timeMin = new Date(`${date}T06:00:00+02:00`);
      const timeMax = new Date(`${date}T22:00:00+02:00`);

      const service = await prisma.service.findFirst({
        where: { tenantId, name: { contains: serviceName, mode: 'insensitive' } },
        include: { staffMembers: { include: { staff: true } } }
      });

      if (!service) {
        throw new Error(`Usługa o nazwie ${serviceName} nie została znaleziona.`);
      }

      let targetStaffIds: string[] = [];
      const staffList = service.staffMembers.map(sm => sm.staff).filter(s => s.isActive);
      const allStaffList = await prisma.staffMember.findMany({ where: { tenantId, isActive: true } });

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const isTeam = tenant?.businessProfile === 'team' || tenant?.businessProfile === 'facility';

      if (preferredStaffName) {
        const preferred = staffList.find(s => s.name.toLowerCase().includes(preferredStaffName.toLowerCase()));
        if (preferred) {
          targetStaffIds = [preferred.id];
        } else {
          throw new Error(`Nie znaleziono pracownika o imieniu ${preferredStaffName} wykonującego tę usługę.`);
        }
      } else if (staffList.length > 0) {
        targetStaffIds = staffList.map(s => s.id);
      } else if (isTeam) {
        targetStaffIds = allStaffList.map(s => s.id);
      }

      const appointments = await prisma.appointment.findMany({
        where: {
          tenantId,
          startTime: { gte: timeMin, lt: timeMax },
          status: 'confirmed'
        },
        orderBy: { startTime: 'asc' }
      });

      const availableSlots: string[] = [];
      const slotStepMs = 30 * 60000; 
      let currentSlot = timeMin.getTime();
      const now = new Date().getTime();

      while (currentSlot + (durationMinutes * 60000) <= timeMax.getTime()) {
        const slotEnd = currentSlot + (durationMinutes * 60000);
        
        if (currentSlot <= now) {
          currentSlot += slotStepMs;
          continue;
        }

        let hasSlot = false;

        if (targetStaffIds.length > 0) {
          for (const staffId of targetStaffIds) {
            const staff = allStaffList.find(s => s.id === staffId);
            const [wStart, wEnd] = (staff?.workingHours || '08:00-20:00').split('-');
            const staffTimeMin = new Date(`${date}T${wStart}:00+02:00`).getTime();
            const staffTimeMax = new Date(`${date}T${wEnd}:00+02:00`).getTime();

            if (currentSlot < staffTimeMin || slotEnd > staffTimeMax) continue;

            const staffAppointments = appointments.filter(a => a.staffId === staffId);
            const conflict = staffAppointments.some(a => {
              return (currentSlot < a.endTime.getTime() && slotEnd > a.startTime.getTime());
            });
            if (!conflict) {
              hasSlot = true;
              break;
            }
          }
        } else {
          // Tryb Solo - tu przyjmujemy domyślne np. 08:00-20:00
          const staffTimeMin = new Date(`${date}T08:00:00+02:00`).getTime();
          const staffTimeMax = new Date(`${date}T20:00:00+02:00`).getTime();
          
          if (currentSlot >= staffTimeMin && slotEnd <= staffTimeMax) {
            const conflict = appointments.some(a => {
              return (currentSlot < a.endTime.getTime() && slotEnd > a.startTime.getTime());
            });
            if (!conflict) hasSlot = true;
          }
        }

        if (hasSlot) {
          const slotDate = new Date(currentSlot);
          const timeString = new Intl.DateTimeFormat('pl-PL', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw'
          }).format(slotDate);
          availableSlots.push(timeString);
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
    durationMinutes: number,
    preferredStaffName?: string
  ): Promise<boolean> {
    try {
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      const service = await prisma.service.findFirst({
        where: { tenantId, name: { contains: serviceName, mode: 'insensitive' } },
        include: { staffMembers: { include: { staff: true } } }
      });

      if (!service) {
        throw new Error(`Usługa o nazwie ${serviceName} nie została znaleziona.`);
      }

      const existingAppointment = await prisma.appointment.findFirst({
        where: { tenantId, customerPhone, serviceId: service.id, startTime: startDate }
      });

      if (existingAppointment) {
        console.log(`Rezerwacja dla ${customerPhone} na ${startTime} już istnieje.`);
        return true;
      }

      // 1. Znajdź listę kandydatów do wykonania usługi
      let targetStaffIds: string[] = [];
      const staffList = service.staffMembers.map(sm => sm.staff).filter(s => s.isActive);
      
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const isTeam = tenant?.businessProfile === 'team' || tenant?.businessProfile === 'facility';

      if (preferredStaffName) {
        const preferred = staffList.find(s => s.name.toLowerCase().includes(preferredStaffName.toLowerCase()));
        if (preferred) targetStaffIds = [preferred.id];
        else throw new Error(`Pracownik ${preferredStaffName} nie wykonuje tej usługi.`);
      } else if (staffList.length > 0) {
        targetStaffIds = staffList.map(s => s.id);
      } else if (isTeam) {
        // Fallback: jeśli nie przypisano żadnego pracownika do tej usługi w panelu (np. błąd usera),
        // weźmy po prostu wszystkich aktywnych pracowników w firmie jako kandydatów do wyboru.
        const allStaff = await prisma.staffMember.findMany({ where: { tenantId, isActive: true } });
        targetStaffIds = allStaff.map(s => s.id);
      }

      let assignedStaffId: string | null = null;

      // 2. Weryfikacja i znalezienie Pierwszego Wolnego
      if (targetStaffIds.length > 0) {
        for (const staffId of targetStaffIds) {
          const conflict = await prisma.appointment.findFirst({
            where: {
              tenantId,
              staffId,
              status: 'confirmed',
              OR: [
                { startTime: { lt: endDate }, endTime: { gt: startDate } }
              ]
            }
          });
          if (!conflict) {
            assignedStaffId = staffId;
            break;
          }
        }
        
        if (!assignedStaffId) {
          throw new Error(`KRYTYCZNY BŁĄD: Podany termin (${startTime}) jest już w pełni zajęty przez wszystkich pracowników! Zaoferuj klientowi inną godzinę.`);
        }
      } else {
        // Tryb Solo (weryfikacja ogólna bez staffId)
        const conflict = await prisma.appointment.findFirst({
          where: {
            tenantId,
            status: 'confirmed',
            OR: [
              { startTime: { lt: endDate }, endTime: { gt: startDate } }
            ]
          }
        });
        if (conflict) throw new Error(`KRYTYCZNY BŁĄD: Podany termin (${startTime}) jest już w pełni zajęty w bazie danych!`);
      }

      await prisma.appointment.create({
        data: {
          tenantId,
          serviceId: service.id,
          staffId: assignedStaffId,
          customerName,
          customerPhone,
          startTime: startDate,
          endTime: endDate,
          status: 'confirmed'
        }
      });

      // 4. Wyślij powiadomienie SMS o potwierdzeniu z możliwością anulowania
      const formattedDate = startDate.toLocaleString('pl-PL', { 
        timeZone: 'Europe/Warsaw',
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
      });
      
      const smsBody = `Potwierdzamy rezerwację na ${service.name} w dniu ${formattedDate}. Jeśli chcesz anulować wizytę, wyślij SMS o treści ANULUJ na ten numer.`;
      
      SMSService.sendSMS(customerPhone, smsBody).catch(console.error);

      return true;
    } catch (error) {
      console.error('Błąd rezerwacji DB:', error);
      throw new Error('Wystąpił problem podczas próby zapisania wizyty.');
    }
  }
}

export const bookingService = new BookingService();
