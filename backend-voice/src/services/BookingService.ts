import { SMSService } from './sms/SMSService';
import { prisma } from '../prisma';

export interface ServiceItem {
  id: string;
  name: string;
  price: string;
  durationMinutes: number;
}

export class BookingService {
  public async saveNpsScore(tenantId: string, phone: string, score: number): Promise<boolean> {
    try {
      const now = new Date();
      const lastApp = await prisma.appointment.findFirst({
        where: {
          tenantId,
          customerPhone: phone,
          endTime: { lt: now },
          surveySent: true
        },
        orderBy: { endTime: 'desc' }
      });
      if (!lastApp) return false;
      await prisma.appointment.update({
        where: { id: lastApp.id },
        data: { npsScore: score }
      });
      return true;
    } catch (error) {
      console.error('Error saving NPS score:', error);
      return false;
    }
  }

  public async updateCustomerSource(tenantId: string, customerPhone: string, source: string): Promise<boolean> {
    try {
      const customer = await prisma.customer.findFirst({ where: { tenantId, phone: customerPhone } });
      if (customer) {
        await prisma.customer.update({ where: { id: customer.id }, data: { source } });
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
  /**
   * Schematy narzędzi (Function Calling) dla Gemini
   */
  public static getToolDefinitions(
    bookingMode: string = "hourly",
    isVoiceBot: boolean = false,
    callerRole: string = "GUEST",
    businessProfile: string = "solo"
  ) {
    if (businessProfile === 'personal') {
      if (callerRole === 'OWNER') {
        return [
          {
            name: 'get_owner_activity_summary',
            description: 'Pobiera zagregowane podsumowanie połączeń, wiadomości i spotkań dla WŁAŚCICIELA z wybranego okresu czasu.',
            parameters: {
              type: 'OBJECT',
              properties: {
                timeRange: {
                  type: 'STRING',
                  description: 'Okres podsumowania: TODAY (dzisiaj), YESTERDAY (wczoraj), THIS_WEEK (ten tydzień)',
                  enum: ['TODAY', 'YESTERDAY', 'THIS_WEEK']
                }
              },
              required: ['timeRange']
            }
          },
          {
            name: 'send_summary_email',
            description: 'Wysyła aktualny raport lub podsumowanie na adres e-mail WŁAŚCICIELA na jego żądanie ("wyślij mi to na maila").',
            parameters: {
              type: 'OBJECT',
              properties: {
                subject: { type: 'STRING', description: 'Temat wiadomości e-mail' },
                contentMarkdown: { type: 'STRING', description: 'Treść raportu w czytelnym formacie punktowym' }
              },
              required: ['subject', 'contentMarkdown']
            }
          },
          {
            name: 'block_calendar_time',
            description: 'Blokuje czas w kalendarzu na polecenie WŁAŚCICIELA (np. praca w skupieniu, sprawy prywatne, spotkanie wewnętrzne).',
            parameters: {
              type: 'OBJECT',
              properties: {
                startTime: { type: 'STRING', description: 'Data i godzina rozpoczęcia w formacie ISO (np. 2026-05-20T10:00:00+02:00)' },
                durationMinutes: { type: 'INTEGER', description: 'Czas trwania blokady w minutach (np. 60, 120)' },
                title: { type: 'STRING', description: 'Krótki opis blokady (np. Praca w skupieniu, Lekarz, Spotkanie prywatne)' }
              },
              required: ['startTime', 'durationMinutes']
            }
          },
          {
            name: 'endCall',
            description: 'Kończy połączenie i odkłada słuchawkę. Wywołaj to narzędzie, gdy Właściciel zakończy rozmowę i pożegna się.',
            parameters: { type: 'OBJECT', properties: {} }
          }
        ];
      }

      // Dla VIP i GOŚCI w profilu personal:
      return [
        {
          name: 'checkAvailability',
          description: 'Sprawdza wolne okna w kalendarzu na dany dzień z uwzględnieniem bufora czasowego i dyskrecji.',
          parameters: {
            type: 'OBJECT',
            properties: {
              date: { type: 'STRING', description: 'Data w formacie YYYY-MM-DD' },
              durationMinutes: { type: 'INTEGER', description: 'Czas trwania spotkania w minutach (domyślnie 30)' },
              serviceName: { type: 'STRING', description: 'Temat lub cel spotkania (opcjonalnie)' }
            },
            required: ['date']
          }
        },
        {
          name: 'bookAppointment',
          description: 'Rezerwuje termin spotkania w kalendarzu po uzgodnieniu z dzwoniącym.',
          parameters: {
            type: 'OBJECT',
            properties: {
              customerName: { type: 'STRING', description: 'Imię i nazwisko dzwoniącego' },
              customerPhone: { type: 'STRING', description: 'Numer telefonu dzwoniącego' },
              startTime: { type: 'STRING', description: 'Data i godzina rozpoczęcia w ISO' },
              durationMinutes: { type: 'INTEGER', description: 'Czas trwania w minutach' },
              serviceName: { type: 'STRING', description: 'Temat spotkania lub konsultacji' }
            },
            required: ['customerName', 'customerPhone', 'startTime', 'durationMinutes']
          }
        },
        {
          name: 'save_call_message',
          description: 'Zapisuje wiadomość od dzwoniącego, generuje skrót i wysyła natychmiastowe powiadomienie Push do właściciela.',
          parameters: {
            type: 'OBJECT',
            properties: {
              callerName: { type: 'STRING', description: 'Imię i nazwisko osoby zostawiającej wiadomość' },
              rawMessage: { type: 'STRING', description: 'Dokładna treść przekazanej wiadomości lub prośby' },
              urgency: {
                type: 'STRING',
                description: 'Poziom pilności sprawy',
                enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL']
              },
              callbackRequested: { type: 'BOOLEAN', description: 'Czy dzwoniący prosi o pilny kontakt zwrotny' }
            },
            required: ['callerName', 'rawMessage', 'urgency']
          }
        },
        {
          name: 'getFAQ',
          description: 'Pobiera odpowiedzi na pytania dotyczące działalności właściciela (baza wiedzy).',
          parameters: { type: 'OBJECT', properties: {} }
        },
        {
          name: 'requestHumanContact',
          description: 'Informuje właściciela o pilnej prośbie o kontakt telefoniczny.',
          parameters: {
            type: 'OBJECT',
            properties: {
              customerPhone: { type: 'STRING', description: 'Numer telefonu' },
              reason: { type: 'STRING', description: 'Powód kontaktu' }
            },
            required: ['customerPhone', 'reason']
          }
        },
        {
          name: 'endCall',
          description: 'Kończy połączenie i odkłada słuchawkę po pożegnaniu.',
          parameters: { type: 'OBJECT', properties: {} }
        }
      ];
    }

    const allTools = [
          {
            name: 'send_nps_surveys',
            description: 'Wysyła ankiety badania zadowolenia do klientów po wizycie (np. dla ostatnich wizyt). Prosi o wpisanie message_content w którym określamy treść ankiety. ZAWSZE JAKO DOMYŚLNY message_content UŻYJ DOKŁADNIE TEGO TEKSTU: "Dzień dobry! Jak oceniasz Naszą usługę w skali od 0 do 5? Twoja opinia jest dla nas bardzo ważna. Odpowiedz na tę wiadomość, wpisując samą cyfrę. Dziękujemy!"',
            parameters: {
              type: 'OBJECT',
              properties: {
                campaign_name: { type: 'STRING', description: 'Nazwa robocza kampanii zadowolenia' },
                audience_tags: { type: 'STRING', description: 'Tagi docelowe (np. #wczorajsi) lub puste' },
                customerPhone: { type: 'STRING', description: 'Konkretny numer telefonu klienta (opcjonalnie)' },
                channel: { type: 'STRING', description: 'Kanał wysyłki (sms)', enum: ['sms'] },
                message_content: { type: 'STRING', description: 'Treść powiadomienia NPS. (ZAWSZE UŻYWAJ TEKSTU Z OPISU!)' }
              },
              required: ['message_content', 'channel', 'audience_tags', 'campaign_name']
            }
          },
      {
        name: 'confirmAppointment',
        description: 'Potwierdza rezerwację w systemie. Użyj tego narzędzia, gdy dzwonisz do klienta by potwierdzić rezerwację i klient odpowie twierdząco (np. "Tak, będę"). Jeśli znasz ID rezerwacji z kontekstu, podaj je.',
        parameters: {
          type: 'OBJECT',
          properties: {
            customerPhone: { type: 'STRING', description: 'Numer telefonu klienta, z którym aktualnie rozmawiasz' },
            appointmentId: { type: 'STRING', description: 'ID rezerwacji (opcjonalnie)' }
          },
          required: ['customerPhone']
        }
      },
      {
        name: 'cancelAppointment',
        description: 'Odwołuje rezerwację w systemie. Użyj tego narzędzia, gdy klient poinformuje, że nie przyjdzie, chce zrezygnować, lub odpowie przecząco na prośbę o potwierdzenie wizyty.',
        parameters: {
          type: 'OBJECT',
          properties: {
            customerPhone: { type: 'STRING', description: 'Numer telefonu klienta' }
          },
          required: ['customerPhone']
        }
      },

        
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
          {
            name: 'requestHumanContact',
            description: 'Przekazuje prośbę o kontakt do żywego człowieka (recepcji). Użyj tego, gdy klient prosi o człowieka, lub gdy wpadniesz w pętlę krytycznych błędów z danymi (odrzucana rezerwacja).',
            parameters: {
              type: 'OBJECT',
              properties: {
                customerPhone: { type: 'STRING', description: 'Numer telefonu klienta' },
                reason: { type: 'STRING', description: 'Krótki powód prośby o kontakt (np. zły format numeru, klient chce rozmawiać z człowiekiem)' }
              },
              required: ['customerPhone', 'reason']
            }
          },
          {
            name: 'create_informational_campaign',
          description: 'Przygotowuje kampanię informacyjną lub promocyjną (SMS / Voice) dla wybranej grupy lub pojedynczego klienta. Zwróć to ZAWSZE, gdy właściciel prosi o wysłanie promocji, powiadomień lub SMSów.',
          parameters: {
            type: 'OBJECT',
            properties: {
              campaign_name: { type: 'STRING', description: 'Nazwa robocza kampanii' },
              channel: { type: 'STRING', description: 'Kanał: sms lub voice_call' },
              audience_tags: { type: 'STRING', description: 'Tagi odbiorców np. #vip, #uśpieni (rozdzielone przecinkami) lub puste jeśli do wszystkich' },
              message_content: { type: 'STRING', description: 'Treść wiadomości SMS lub instrukcja dla Voice Bota. ZAWSZE używaj słowa \'rezerwacja\' zamiast \'wizyta\', zwracaj się do klienta na \'Ty\' (np. \'za Tobą\'), ale w imieniu firmy używaj liczby mnogiej (np. \'Tęsknimy\' zamiast \'Tęsknię\')' },
              scheduled_time: { type: 'STRING', description: 'Kiedy wysłać (np. now, 2026-05-01)' }
            },
            required: ['channel', 'message_content']
          }
        },
        
          {
            name: 'create_last_minute_offer',
            description: 'Uruchamia kampanię wyścigową (First-Come, First-Served) dla luki w kalendarzu. Używaj zawsze, gdy właściciel prosi o wysłanie oferty "Last minute" i wskazuje termin okienka.',
            parameters: {
              type: 'OBJECT',
              properties: {
                campaign_name: { type: 'STRING', description: 'Nazwa robocza kampanii last minute' },
                audience_tags: { type: 'STRING', description: 'Tagi docelowe (np. #lojalny, #uśpieni) lub puste' },
                channel: { type: 'STRING', description: 'Kanał wysyłki (sms lub voice_call)', enum: ['sms', 'voice_call'] },
                service_name: { type: 'STRING', description: 'Opcjonalna nazwa zwalniającego się obiektu/usługi (np. Domek 6-osobowy)' },
                message_content: { type: 'STRING', description: 'Treść powiadomienia zachęcająca do odpowiedzi TAK. Jeśli promują konkretną usługę, zamiast jej nazwy wpisz DOKŁADNIE tag [USŁUGA] (np. Zwolnił się [USŁUGA] dzisiaj o 16:00! Odpisz TAK, aby zarezerwować!)' },
                target_datetime: { type: 'STRING', description: 'Data i godzina zwalniającego się terminu w formacie ISO (ZAWSZE podawaj dzisiejszą datę w formacie YYYY-MM-DD, a nie historyczną!)' }
              },
              required: ['message_content', 'target_datetime', 'channel', 'audience_tags', 'service_name']
            }
          },
          {
            name: 'schedule_confirmation_flow',
          description: 'Uruchamia interaktywny mechanizm potwierdzania rezerwacji.',
          parameters: {
            type: 'OBJECT',
            properties: {
              target_scope: { type: 'STRING', description: 'Zakres: tomorrow_appointments, specific_date, specific_customer' },
                customerPhone: { type: 'STRING', description: 'Opcjonalny numer telefonu (dla specific_customer)' },
              confirmation_method: { type: 'STRING', description: 'Metoda: sms_two_way, voice_interactive' }
            },
            required: ['target_scope', 'confirmation_method']
          }
        },
      {
        name: 'getServicesAndPrices',
        description: 'Pobiera aktualny cennik usług oraz listę personelu. ZAWSZE wywołaj to narzędzie na początku rozmowy, gdy klient pyta o ofertę, ceny lub dostępne zabiegi.',
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
            numberOfNights: { type: 'INTEGER', description: 'Liczba dób pobytu (tylko daily)' },
            promoCode: { type: 'STRING', description: 'Opcjonalny kod rabatowy podany przez klienta (np. POWROT15)' }
          },
          required: bookingMode === 'daily' ? ['customerName', 'customerPhone', 'serviceName', 'startTime', 'numberOfNights'] : ['customerName', 'customerPhone', 'serviceName', 'startTime', 'durationMinutes'],
        },
      },
      {
        name: 'endCall',
        description: 'Kończy połączenie telefoniczne i odkłada słuchawkę. Użyj tego narzędzia, gdy klient pożegna się (np. "Dziękuję, do widzenia", "Na razie", "To wszystko"), sprawa została załatwiona i nadszedł moment zakończenia rozmowy.',
        parameters: { type: 'OBJECT', properties: {} },
      },
    ];

    if (isVoiceBot) {
      return allTools.filter(t => !['create_informational_campaign', 'create_last_minute_offer', 'schedule_confirmation_flow', 'send_nps_surveys'].includes(t.name));
    }
    return allTools;
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
      const bufferMinutes = tenant?.bufferMinutes || 0;
      const bufferMs = bufferMinutes * 60000;
      
      let service = await prisma.service.findFirst({
        where: { tenantId, name: { contains: serviceName || '', mode: 'insensitive' } },
        include: { staffMembers: { include: { staff: true } } }
      });

      if (!service) {
        if (tenant?.businessProfile === 'personal') {
          service = await prisma.service.findFirst({
            where: { tenantId },
            include: { staffMembers: { include: { staff: true } } }
          });
          if (!service) {
            const newSvc = await prisma.service.create({
              data: { tenantId, name: serviceName || 'Spotkanie', price: 0, durationMinutes: durationMinutes || 30 }
            });
            service = { ...newSvc, staffMembers: [] };
          }
        } else {
          throw new Error(`Usługa o nazwie ${serviceName} nie została znaleziona.`);
        }
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
            status: { in: ['confirmed', 'confirmed_by_client'] },
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
          where: { tenantId, startTime: { gte: reqDate, lt: nextDate }, status: { in: ['confirmed', 'confirmed_by_client'] } },
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
              const conflict = staffAppointments.some(a => {
                const aStart = a.startTime.getTime() - bufferMs;
                const aEnd = a.endTime.getTime() + bufferMs;
                return currentSlot < aEnd && slotEnd > aStart;
              });
              
              if (!conflict) {
                hasSlot = true;
                break;
              }
            }
          } else {
            const staffTimeMin = reqDate.getTime() + 8 * 60 * 60 * 1000;
            const staffTimeMax = reqDate.getTime() + 20 * 60 * 60 * 1000;
            if (currentSlot >= staffTimeMin && slotEnd <= staffTimeMax) {
              const conflict = appointments.some(a => {
                const aStart = a.startTime.getTime() - bufferMs;
                const aEnd = a.endTime.getTime() + bufferMs;
                return currentSlot < aEnd && slotEnd > aStart;
              });
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
  public async confirmAppointment(tenantId: string, customerPhone: string) {
    try {
      const appointments = await prisma.appointment.findMany({
        where: { tenantId, customerPhone, status: { in: ['confirmed', 'confirmed_by_client'] } },
        orderBy: { startTime: 'asc' },
        take: 1
      });
      if (appointments.length > 0) {
        await prisma.appointment.update({
          where: { id: appointments[0].id },
          data: { status: 'confirmed_by_client' }
        });
        return { success: true, message: "Rezerwacja została pomyślnie potwierdzona." };
      }
      
      const lastMinuteList = await prisma.appointment.findMany({
        where: { tenantId, status: 'last_minute_offer', startTime: { gt: new Date() } },
        orderBy: { startTime: 'asc' },
        take: 1
      });
      if (lastMinuteList.length > 0) {
          const offer = lastMinuteList[0];
          const cust = await prisma.customer.findFirst({ where: { phone: customerPhone, tenantId } });
          const nameToSave = cust ? cust.name : `Nieznany (tel: ${customerPhone})`;
          await prisma.appointment.update({
             where: { id: offer.id },
             data: { status: 'confirmed_by_client', customerPhone: customerPhone, customerName: nameToSave, customerId: cust ? cust.id : null }
          });
          return { success: true, message: "Rezerwacja została pomyślnie potwierdzona i przypisana klientowi." };
      }
      
      return { success: false, message: "Nie znaleziono rezerwacji do potwierdzenia dla tego numeru." };
    } catch(e) { return { error: e.message }; }
  }

  public async cancelAppointment(tenantId: string, customerPhone: string) {
    try {
      const appointments = await prisma.appointment.findMany({
        where: { tenantId, customerPhone, status: { in: ['confirmed', 'confirmed_by_client'] } },
        orderBy: { startTime: 'asc' },
        take: 1
      });
      if (appointments.length > 0) {
        await prisma.appointment.update({
          where: { id: appointments[0].id },
          data: { status: 'cancelled' }
        });
        return { success: true, message: "Rezerwacja została odwołana." };
      }
      return { success: false, message: "Nie znaleziono rezerwacji do odwołania." };
    } catch(e) { return { error: e.message }; }
  }

  public async requestHumanContact(tenantId: string, customerPhone: string, reason: string) {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (tenant?.fcmTokens && tenant.fcmTokens.length > 0) {
        const { PushService } = await import('./PushService');
        await PushService.sendNotification(
          tenant.fcmTokens,
          'Prośba o kontakt (AI)',
          `Klient prosi o kontakt. Numer: ${customerPhone}. Powód: ${reason}`,
          '',
          customerPhone
        );
      }
      return { success: true, message: 'Powiadomienie zostało wysłane. Możesz się pożegnać.' };
    } catch(e: any) {
      console.error('Błąd przy requestHumanContact:', e);
      return { error: e.message };
    }
  }

  public async bookAppointment(
    tenantId: string,
    customerName: string,
    customerPhone: string,
    serviceName: string,
    startTime: string,
    durationMinutes: number,
    preferredStaffName?: string,
    bookingMode: string = "hourly",
    numberOfNights?: number,
    promoCode?: string,
    callerPhone?: string
  ): Promise<boolean> {
    try {
      let isForeign = false;
      if (customerPhone.trim().startsWith('+') && !customerPhone.replace(/\s/g, '').startsWith('+48')) {
        isForeign = true;
      }
      const rawPhone = customerPhone.replace(/[\s\-\+]/g, '');
      const phoneDigits = rawPhone.startsWith('48') ? rawPhone.substring(2) : (rawPhone.startsWith('0048') ? rawPhone.substring(4) : rawPhone);
      
      if (isForeign) {
        if (rawPhone.length < 9 || rawPhone.length > 15) {
          throw new Error("BŁĄD DANYCH: Zagraniczny numer telefonu musi mieć od 9 do 15 cyfr. Obecnie podałeś: " + customerPhone + ". Poproś klienta o podanie poprawnego numeru telefonu.");
        }
      } else {
        if (!/^\d{9}$/.test(phoneDigits)) {
          throw new Error("BŁĄD DANYCH: Polski numer telefonu musi składać się z dokładnie 9 cyfr. Obecnie podałeś: " + phoneDigits + " (" + phoneDigits.length + " cyfr). Poproś klienta o podanie poprawnego 9-cyfrowego numeru telefonu bez numeru kierunkowego lub z prefiksem +48.");
        }
      }
      
      const cleanName = customerName.trim();
      if (cleanName.length < 3 || /\d/.test(cleanName)) {
         throw new Error("BŁĄD DANYCH: Imię klienta '" + cleanName + "' jest za krótkie lub zawiera cyfry. Poproś klienta o przeliterowanie imienia.");
      }

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

      let service = await prisma.service.findFirst({
        where: { tenantId, name: { contains: serviceName || '', mode: 'insensitive' } },
        include: { staffMembers: { include: { staff: true } } }
      });

      if (!service) {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (tenant?.businessProfile === 'personal') {
          service = await prisma.service.findFirst({
            where: { tenantId },
            include: { staffMembers: { include: { staff: true } } }
          });
          if (!service) {
            const newSvc = await prisma.service.create({
              data: { tenantId, name: serviceName || 'Spotkanie / Konsultacja', price: 0, durationMinutes: durationMinutes || 30 }
            });
            service = { ...newSvc, staffMembers: [] };
          }
        } else {
          throw new Error(`Usługa o nazwie ${serviceName} nie została znaleziona.`);
        }
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
                status: { in: ['confirmed', 'confirmed_by_client'] },
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
                status: { in: ['confirmed', 'confirmed_by_client'] },
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
              status: { in: ['confirmed', 'confirmed_by_client'] },
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
          status: 'confirmed',
          promoCode: promoCode || null,
          callerPhone: callerPhone || null
        }
      });

      // Update tags & lastVisit
      const visitCount = await prisma.appointment.count({
        where: { tenantId, customerId: customer.id, status: { in: ['confirmed', 'confirmed_by_client'] } }
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
    } catch (error: any) {
      console.error('Błąd rezerwacji DB:', error);
      // Przekazujemy dokładny błąd walidacji do asystenta AI, żeby wiedział co powiedzieć klientowi
      if (error instanceof Error && (error.message.includes('BŁĄD DANYCH') || error.message.includes('KRYTYCZNY BŁĄD'))) {
        throw error;
      }
      throw new Error('Wystąpił problem podczas próby zapisania wizyty. Spróbuj jeszcze raz lub przeproś klienta.');
    }
  }

  /**
   * POBIERA ZAGREGOWANY RAPORT DLA WŁAŚCICIELA (Owner Executive Summary)
   */
  public async getOwnerActivitySummary(tenantId: string, timeRange: string = "TODAY") {
    try {
      const now = new Date();
      let fromDate = new Date();
      fromDate.setHours(0, 0, 0, 0);

      if (timeRange === "YESTERDAY") {
        fromDate.setDate(fromDate.getDate() - 1);
        const toDate = new Date(fromDate);
        toDate.setHours(23, 59, 59, 999);
      } else if (timeRange === "THIS_WEEK") {
        const day = fromDate.getDay();
        const diff = fromDate.getDate() - day + (day === 0 ? -6 : 1); // od poniedziałku
        fromDate.setDate(diff);
      }

      const [callLogs, appointments] = await Promise.all([
        prisma.callLog.findMany({
          where: {
            tenantId,
            callerRole: { not: 'OWNER' },
            createdAt: { gte: fromDate }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.appointment.findMany({
          where: {
            tenantId,
            startTime: { gte: fromDate },
            status: { not: 'cancelled' }
          },
          orderBy: { startTime: 'asc' },
          include: { service: true }
        })
      ]);

      const messagesWaiting = callLogs.filter(c => c.isMessageLeft);
      const urgentMessages = callLogs.filter(c => c.urgency === 'HIGH' || c.urgency === 'CRITICAL');

      return {
        timeRange,
        totalCalls: callLogs.length,
        messagesCount: messagesWaiting.length,
        urgentCount: urgentMessages.length,
        appointmentsCount: appointments.length,
        messages: messagesWaiting.map(m => ({
          who: m.callerName || m.callerPhone,
          role: m.callerRole,
          urgency: m.urgency,
          summary: m.summary || 'Brak skrótu',
          action: m.actionItems || 'Brak'
        })),
        upcomingAppointments: appointments.map(a => ({
          client: a.customerName,
          phone: a.customerPhone,
          start: new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Europe/Warsaw' }).format(a.startTime),
          topic: a.service?.name || 'Spotkanie'
        }))
      };
    } catch (err: any) {
      console.error('[BookingService] Błąd w getOwnerActivitySummary:', err);
      return { error: err.message || "Błąd pobierania raportu." };
    }
  }

  /**
   * WYSYŁA RAPORT NA E-MAIL WŁAŚCICIELA NA JEGO ŻĄDANIE ("wyślij mi to na maila")
   */
  public async sendSummaryEmail(tenantId: string, subject: string, contentMarkdown: string) {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const email = tenant?.contactEmail || tenant?.betaContactEmail;
      if (!email) {
        return { error: "Brak skonfigurowanego adresu e-mail w Twoim profilu. Uzupełnij e-mail w Ustawieniach." };
      }

      const { EmailService } = await import('./email/EmailService');
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #111827; margin-top: 0; font-size: 20px;">${subject}</h2>
          <p style="color: #6b7280; font-size: 14px;">Zestawienie wygenerowane przez Twojego Asystenta Głosowego EVA na Twoje żądanie podczas rozmowy telefonicznej.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <div style="color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-line;">
            ${contentMarkdown}
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">EVA Voice Assistant &copy; ${new Date().getFullYear()}</p>
        </div>
      `;

      const sent = await EmailService.sendEmail(email, subject, html, contentMarkdown);
      return { success: sent, message: sent ? `Raport został wysłany na Twój adres e-mail (${email}).` : "Błąd podczas wysyłki wiadomości e-mail." };
    } catch (err: any) {
      console.error('[BookingService] Błąd w sendSummaryEmail:', err);
      return { error: err.message || "Błąd wysyłki e-mail." };
    }
  }

  /**
   * ZAPISUJE WIADOMOŚĆ OD DZWONIĄCEGO I WYSYŁA NATYCHMIASTOWY PUSH DO WŁAŚCICIELA
   */
  public async saveCallMessage(
    tenantId: string,
    callerPhone: string,
    callerName: string,
    rawMessage: string,
    urgency: string = "NORMAL",
    callbackRequested: boolean = true
  ) {
    try {
      const callLog = await prisma.callLog.create({
        data: {
          tenantId,
          callerPhone: callerPhone || 'nieznany',
          callerName: callerName || 'Nieznany rozmówca',
          callerRole: 'GUEST',
          durationSeconds: 0,
          status: 'message_left',
          summary: rawMessage,
          actionItems: callbackRequested ? 'Prośba o pilny kontakt telefoniczny' : undefined,
          isMessageLeft: true,
          urgency: urgency.toUpperCase(),
          isProcessed: false
        }
      });

      // Natychmiastowy Push FCM do właściciela
      try {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (tenant?.fcmTokens && tenant.fcmTokens.length > 0) {
          const { PushService } = await import('./PushService');
          const priorityIcon = (urgency.toUpperCase() === 'HIGH' || urgency.toUpperCase() === 'CRITICAL') ? '🚨 [PILNE]' : '📩';
          await PushService.sendNotification(
            tenant.fcmTokens,
            `${priorityIcon} Wiadomość od: ${callerName || callerPhone}`,
            rawMessage,
            'https://beautyvoice-bff.web.app/dashboard',
            callerPhone
          );
          await prisma.callLog.update({ where: { id: callLog.id }, data: { pushSent: true } });
        }
      } catch (pushErr) {
        console.error('[BookingService] Błąd wysyłki Push w saveCallMessage:', pushErr);
      }

      return { success: true, message: "Wiadomość została zapisana i przekazana właścicielowi w powiadomieniu." };
    } catch (err: any) {
      console.error('[BookingService] Błąd w saveCallMessage:', err);
      return { error: err.message || "Błąd zapisu wiadomości." };
    }
  }

  /**
   * BLOKUJE CZAS W KALENDARZU NA POLECENIE WŁAŚCICIELA
   */
  public async blockCalendarTime(
    tenantId: string,
    startTime: string,
    durationMinutes: number = 60,
    title: string = "Praca w skupieniu / Zablokowany czas"
  ) {
    try {
      let service = await prisma.service.findFirst({ where: { tenantId } });
      if (!service) {
        service = await prisma.service.create({
          data: { tenantId, name: 'Blokada kalendarza', price: 0, durationMinutes }
        });
      }
      const start = new Date(startTime);
      const end = new Date(start.getTime() + durationMinutes * 60000);

      const appt = await prisma.appointment.create({
        data: {
          tenantId,
          serviceId: service.id,
          customerName: title || 'Praca w skupieniu',
          customerPhone: 'OWNER',
          startTime: start,
          endTime: end,
          status: 'confirmed'
        }
      });

      const timeStr = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }).format(start);
      return { success: true, message: `Zablokowano czas w kalendarzu od ${timeStr} na ${durationMinutes} minut.` };
    } catch (err: any) {
      console.error('[BookingService] Błąd w blockCalendarTime:', err);
      return { error: err.message || "Błąd blokowania czasu." };
    }
  }
}

export const bookingService = new BookingService();
