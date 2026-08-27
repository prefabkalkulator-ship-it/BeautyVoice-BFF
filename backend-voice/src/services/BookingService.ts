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
  public static getToolDefinitions(bookingMode: string = "hourly") {
    return [

        {
          name: 'create_informational_campaign',
          description: 'Przygotowuje kampanię informacyjną lub promocyjną (SMS / Voice) dla wybranej grupy lub pojedynczego klienta. Zwróć to ZAWSZE, gdy właściciel prosi o wysłanie promocji, powiadomień lub SMSów.',
          parameters: {
            type: 'OBJECT',
            properties: {
              campaign_name: { type: 'STRING', description: 'Nazwa robocza kampanii' },
              channel: { type: 'STRING', description: 'Kanał: sms lub voice_call' },
              audience_tags: { type: 'STRING', description: 'Tagi odbiorców np. #vip, #uśpieni (rozdzielone przecinkami) lub puste jeśli do wszystkich' },
              message_content: { type: 'STRING', description: 'Treść wiadomości SMS lub instrukcja dla Voice Bota' },
              scheduled_time: { type: 'STRING', description: 'Kiedy wysłać (np. now, 2026-05-01)' }
            },
            required: ['channel', 'message_content']
          }
        },
        
          {
            name: 'create_last_minute_offer',
            description: 'Uruchamia kampanię wyścigową (First-Come, First-Served) SMS dla luki w kalendarzu. Używaj zawsze, gdy właściciel prosi o wysłanie oferty "Last minute" i wskazuje termin okienka.',
            parameters: {
              type: 'OBJECT',
              properties: {
                campaign_name: { type: 'STRING', description: 'Nazwa robocza kampanii last minute' },
                audience_tags: { type: 'STRING', description: 'Tagi docelowe (np. #lojalny, #uśpieni) lub puste' },
                message_content: { type: 'STRING', description: 'Treść SMSa, musi zachęcać do odpowiedzi TAK (np. Dziś o 14:00 zwolnił się termin. Zarezerwuj odpisując TAK!)' },
                target_datetime: { type: 'STRING', description: 'Data i godzina zwalniającego się terminu w formacie ISO (np. 2026-08-27T14:00:00Z)' }
              },
              required: ['message_content', 'target_datetime']
            }
          },
          {
            name: 'schedule_confirmation_flow',
          description: 'Uruchamia interaktywny mechanizm potwierdzania rezerwacji.',
          parameters: {
            type: 'OBJECT',
            properties: {
              target_scope: { type: 'STRING', description: 'Zakres: tomorrow_appointments, specific_date' },
              confirmation_method: { type: 'STRING', description: 'Metoda: sms_two_way, voice_interactive' }
            },
            required: ['target_scope', 'confirmation_method']
          }
        },
        {
        name: 'getServicesAndPrices',
        description: 'Pobiera aktualną listę usług salonu (lub pokoi), ceny oraz personel.',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'checkAvailability',
        description: bookingMode === 'daily'
          ? 'Sprawdza dostępność zasobów na doby w zadanym przedziale dat.'
          : 'Sprawdza dostępne godziny na wizytę w danym dniu dla wybranej usługi.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date: {
              type: 'STRING',
              description: bookingMode === 'daily' ? 'Data zameldowania (przyjazdu) w formacie YYYY-MM-DD' : 'Data w formacie YYYY-MM-DD',
            },
            serviceName: { type: 'STRING', description: 'Nazwa wybranej usługi lub pokoju' },
            durationMinutes: { type: 'INTEGER', description: 'Czas trwania w minutach (tylko w trybie hourly)' },
            preferredStaffName: { type: 'STRING', description: 'Imię preferowanego pracownika (opcjonalne)' },
            numberOfNights: { type: 'INTEGER', description: 'Liczba dób pobytu (tylko w trybie daily)' }
          },
          required: bookingMode === 'daily' ? ['date', 'serviceName', 'numberOfNights'] : ['date', 'serviceName', 'durationMinutes'],
        },
      },
      {
        name: 'getFAQ',
        description: 'Pobiera listę najczęściej zadawanych pytań (FAQ).',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'bookAppointment',
        description: 'Rezerwuje wizytę lub wynajem obiektu.',
        parameters: {
          type: 'OBJECT',
          properties: {
            customerName: { type: 'STRING', description: 'Imię klienta' },
            customerPhone: { type: 'STRING', description: 'Numer telefonu klienta' },
            serviceName: { type: 'STRING', description: 'Nazwa usługi / zasobu' },
            preferredStaffName: { type: 'STRING', description: 'Opcjonalnie' },
            startTime: {
              type: 'STRING',
              description: 'Data i godzina rozpoczęcia/zameldowania w ISO (np. 2024-05-20T14:30:00+02:00)',
            },
            durationMinutes: { type: 'INTEGER', description: 'Czas trwania w minutach (tylko hourly)' },
            numberOfNights: { type: 'INTEGER', description: 'Liczba dób pobytu (tylko daily)' }
          },
          required: bookingMode === 'daily' ? ['customerName', 'customerPhone', 'serviceName', 'startTime', 'numberOfNights'] : ['customerName', 'customerPhone', 'serviceName', 'startTime', 'durationMinutes'],
        },
      },
    ];
  }

  /**
   * 1. Pobiera usługi i ceny z bazy danych dla konkretnego najemcy
   */
  public async getServicesAndPrices(tenantId: string): Promise<{ services: ServiceItem[], staff: string[] }> {
    try {
      const services = await prisma.service.findMany({
        where: { tenantId }
      });
      const staffList = await prisma.staffMember.findMany({
        where: { tenantId }
      });
      
      return {
        services: services.map(s => ({
          id: s.id,
          name: s.name,
          price: s.price.toString(),
          durationMinutes: s.durationMinutes,
        })),
        staff: staffList.map(st => st.name)
      };
    } catch (error) {
      console.error('Błąd pobierania cennika i personelu z DB:', error);
      throw new Error('Nie udało się pobrać danych z bazy danych.');
    }
  }

  /**
   * 2. Sprawdza wolne terminy w bazie danych na podstawie bookingMode
   */
  public async checkAvailability(tenantId: string, date: string, serviceName: string, durationMinutes: number, preferredStaffName?: string, bookingMode: string = "hourly", numberOfNights?: number): Promise<string[]> {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const isTeam = tenant?.businessProfile === 'team' || tenant?.businessProfile === 'facility';

      const reqDate = new Date(`${date}T00:00:00+02:00`);
      
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

      if (preferredStaffName) {
        const preferred = staffList.find(s => s.name.toLowerCase().includes(preferredStaffName.toLowerCase()));
        if (preferred) {
          targetStaffIds = [preferred.id];
        } else {
          throw new Error(`Nie znaleziono pokoju/pracownika o nazwie ${preferredStaffName}.`);
        }
      } else if (staffList.length > 0) {
        targetStaffIds = staffList.map(s => s.id);
      } else if (isTeam) {
        targetStaffIds = allStaffList.map(s => s.id);
      }

      if (bookingMode === 'daily') {
        const nights = numberOfNights || 1;
        const checkoutDate = new Date(reqDate.getTime() + nights * 24 * 60 * 60 * 1000);
        
        // Zwykle hotele: doba zaczyna się o 14:00, kończy o 11:00
        const checkInTime = new Date(`${date}T14:00:00+02:00`);
        const checkOutTimeStr = checkoutDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
        const checkOutTime = new Date(`${checkOutTimeStr}T11:00:00+02:00`);

        const appointments = await prisma.appointment.findMany({
          where: {
            tenantId,
            status: 'confirmed',
            OR: [
              { startTime: { lt: checkOutTime }, endTime: { gt: checkInTime } }
            ]
          }
        });

        const availableResources = targetStaffIds.filter(staffId => {
          const conflicts = appointments.filter(a => a.staffId === staffId);
          return conflicts.length === 0;
        });

        if (availableResources.length > 0) {
          return [`Tak, mamy wolny apartament/pokój w terminie od ${date} na ${nights} nocy.`];
        } else {
          return [`Niestety brak wolnych pokoi w podanym terminie.`];
        }
      } else {
        const dayOfWeek = new Date(`${date}T12:00:00Z`).getDay(); 
        const nextDate = new Date(reqDate.getTime() + 24 * 60 * 60 * 1000);

        const timeOffs = await prisma.timeOff.findMany({
          where: { tenantId, startDate: { lt: nextDate }, endDate: { gte: reqDate } }
        });

        if (timeOffs.some(t => t.staffId === null)) return [];

        const appointments = await prisma.appointment.findMany({
          where: { tenantId, startTime: { gte: reqDate, lt: nextDate }, status: 'confirmed' },
          orderBy: { startTime: 'asc' }
        });

        const availableSlots: string[] = [];
        const slotStepMs = 30 * 60000; 
        
        let currentSlot = reqDate.getTime() + 6 * 60 * 60 * 1000;
        const dayEnd = reqDate.getTime() + 22 * 60 * 60 * 1000;
        const now = new Date().getTime();

        while (currentSlot + (durationMinutes * 60000) <= dayEnd) {
          const slotEnd = currentSlot + (durationMinutes * 60000);
          
          if (currentSlot <= now) {
            currentSlot += slotStepMs;
            continue;
          }

          let hasSlot = false;

          if (targetStaffIds.length > 0) {
            for (const staffId of targetStaffIds) {
              const staff = allStaffList.find(s => s.id === staffId);
              if (timeOffs.some(t => t.staffId === staffId)) continue;

              const schedule = staff?.schedule as any;
              const daySchedule = schedule ? schedule[dayOfWeek.toString()] : null;
              
              if (!daySchedule || !daySchedule.isWorking) continue;

              const workStartStr = daySchedule.start || "09:00";
              const workEndStr = daySchedule.end || "17:00";
              
              const [startH, startM] = workStartStr.split(':').map(Number);
              const [endH, endM] = workEndStr.split(':').map(Number);
              
              const staffStartMs = reqDate.getTime() + (startH * 60 + startM) * 60000;
              const staffEndMs = reqDate.getTime() + (endH * 60 + endM) * 60000;

              if (currentSlot < Date.now()) continue;
              if (currentSlot < staffStartMs || slotEnd > staffEndMs) continue;

              const staffAppointments = appointments.filter(a => a.staffId === staffId);
              const conflict = staffAppointments.some(a => (currentSlot < a.endTime.getTime() && slotEnd > a.startTime.getTime()));
              
              if (!conflict) {
                hasSlot = true;
                break;
              }
            }
          } else {
            const staffTimeMin = reqDate.getTime() + 8 * 60 * 60 * 1000;
            const staffTimeMax = reqDate.getTime() + 20 * 60 * 60 * 1000;
            if (currentSlot >= staffTimeMin && slotEnd <= staffTimeMax) {
              const conflict = appointments.some(a => (currentSlot < a.endTime.getTime() && slotEnd > a.startTime.getTime()));
              if (!conflict) hasSlot = true;
            }
          }

          if (hasSlot) {
            const slotDate = new Date(currentSlot);
            const timeString = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }).format(slotDate);
            availableSlots.push(timeString);
          }
          currentSlot += slotStepMs;
        }
        return availableSlots;
      }
    } catch (error: any) {
      console.error('Błąd w checkAvailability:', error);
      throw new Error(error.message || 'Wystąpił błąd przy sprawdzaniu dostępności.');
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
    preferredStaffName?: string,
    bookingMode: string = "hourly",
    numberOfNights?: number
  ): Promise<boolean> {
    try {
      const startDate = new Date(startTime);
      let endDate: Date;
      
      if (bookingMode === 'daily') {
        const nights = numberOfNights || 1;
        // Wymeldowanie o 11:00 po X nocach
        endDate = new Date(startDate.getTime() + nights * 24 * 60 * 60 * 1000);
        const checkOutStr = endDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
        endDate = new Date(`${checkOutStr}T11:00:00+02:00`);
      } else {
        endDate = new Date(startDate.getTime() + durationMinutes * 60000);
      }

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
      if (bookingMode === 'daily') {
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
            throw new Error(`KRYTYCZNY BŁĄD: Brak dostępnych pokoi/apartamentów w podanym terminie!`);
          }
        }
      } else {
        if (targetStaffIds.length > 0) {
          for (const staffId of targetStaffIds) {
            const staff = staffList.find(s => s.id === staffId);
            if (!staff) continue;
            
            const reqDateStrLocal = startDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
            const dayOfWeek = new Date(`${reqDateStrLocal}T12:00:00Z`).getDay();
            
            const schedule = staff.schedule as any;
            const daySchedule = schedule ? schedule[dayOfWeek.toString()] : null;
            
            if (!daySchedule || !daySchedule.isWorking) continue;

            const workStartStr = daySchedule.start || "09:00";
            const workEndStr = daySchedule.end || "17:00";
            
            const [startH, startM] = workStartStr.split(':').map(Number);
            const [endH, endM] = workEndStr.split(':').map(Number);
            
            const reqDateStr = startDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
            const staffStartMs = new Date(`${reqDateStr}T${workStartStr.padStart(5, '0')}:00+02:00`).getTime();
            const staffEndMs = new Date(`${reqDateStr}T${workEndStr.padStart(5, '0')}:00+02:00`).getTime();

            if (startDate.getTime() < staffStartMs || endDate.getTime() > staffEndMs) {
              continue; // Poza godzinami pracy
            }

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
            throw new Error(`KRYTYCZNY BŁĄD: Podany termin (${startTime}) jest już w pełni zajęty! Zaoferuj klientowi inną godzinę.`);
          }
        } else {
          const conflict = await prisma.appointment.findFirst({
            where: {
              tenantId,
              status: 'confirmed',
              OR: [
                { startTime: { lt: endDate }, endTime: { gt: startDate } }
              ]
            }
          });
          if (conflict) {
            throw new Error(`KRYTYCZNY BŁĄD: Podany termin (${startTime}) jest już zajęty!`);
          }
        }
      }

      
      // 3.5. Find or create Customer, logic for Mini-CRM
      let customer = await prisma.customer.findFirst({
        where: { tenantId, phone: customerPhone }
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: { tenantId, name: customerName, phone: customerPhone, tags: [] }
        });
      }

      const createdAppt = await prisma.appointment.create({
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
      });

      // Update tags & lastVisit
      const visitCount = await prisma.appointment.count({
        where: { tenantId, customerId: customer.id, status: 'confirmed' }
      });
      const newTags = new Set(customer.tags || []);
      if (visitCount >= 3) newTags.add('#lojalny');
      if (visitCount >= 5) newTags.add('#vip');

      // Add a service-specific tag based on service name mapping if we wanted, but we'll stick to frequency tags for now.
      
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          lastVisitAt: startDate,
          tags: Array.from(newTags)
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
