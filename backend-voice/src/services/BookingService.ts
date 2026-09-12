import { SMSService } from './sms/SMSService';
import { prisma } from '../prisma';

export interface ServiceItem {
  id: string;
  name: string;
  price: string;
  durationMinutes: number;
}

/**
 * Interpretuje czas w strefie Europe/Warsaw niezależnie od tego, czy na serwerze jest UTC
 * i czy ciąg znaków zawierał literę Z (UTC) czy nie.
 */
export function parseWarsawDateTime(isoOrDateStr: string): Date {
  const match = String(isoOrDateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [_, y, m, d, hh, mm, ss] = match;
    const targetUtc = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss || 0)));
    
    const warsawParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    }).formatToParts(targetUtc);

    const wH = Number(warsawParts.find(p => p.type === 'hour')?.value);
    const wD = Number(warsawParts.find(p => p.type === 'day')?.value);
    
    let diffHours = wH - Number(hh);
    if (wD !== Number(d)) {
      diffHours += (wD > Number(d) ? 24 : -24);
    }
    return new Date(targetUtc.getTime() - diffHours * 3600000);
  }
  return new Date(isoOrDateStr);
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
            description: 'Wysyła pełny, szczegółowy raport wykonawczy (pilne sprawy z numerami telefonów, zarejestrowane rozmowy, spotkania z kalendarza) na adres e-mail WŁAŚCICIELA na jego żądanie ("wyślij mi to na maila").',
            parameters: {
              type: 'OBJECT',
              properties: {
                subject: { type: 'STRING', description: 'Temat wiadomości e-mail np. "📊 Podsumowanie Dnia - 12.09.2026"' },
                contentMarkdown: { type: 'STRING', description: 'Komentarz, wnioski i synteza spraw od asystenta' },
                timeRange: { type: 'STRING', enum: ['TODAY', 'YESTERDAY', 'THIS_WEEK'], description: 'Zakres czasu raportu (domyślnie TODAY)' }
              },
              required: ['subject']
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
            name: 'verify_owner_pin',
            description: 'Weryfikuje kod PIN podany przez Właściciela w celu autoryzacji dostępu do funkcji zarządczych (kalendarz, wiadomości, raporty).',
            parameters: {
              type: 'OBJECT',
              properties: {
                pin: { type: 'STRING', description: 'Kod PIN podyktowany przez Właściciela (same cyfry)' }
              },
              required: ['pin']
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
          name: 'verify_confidential_pin',
          description: 'Weryfikuje kod PIN do Wiedzy Poufnej i odblokowuje chronioną treść na poufne pytanie z Bazy Wiedzy.',
          parameters: {
            type: 'OBJECT',
            properties: {
              pin: { type: 'STRING', description: 'Kod PIN podyktowany przez rozmówcę (same cyfry)' },
              topic: { type: 'STRING', description: 'Temat lub pytanie poufne, o które pyta rozmówca' }
            },
            required: ['pin']
          }
        },
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
        ...(callerRole === 'VIP' ? [{
          name: 'transferCallToOwner',
          description: 'Wywołaj to narzędzie, jeśli dzwoni kontakt VIP/Rodzina z pilną sprawą i kategorycznie prosi o bezpośrednie połączenie z właścicielem.',
          parameters: {
            type: 'OBJECT',
            properties: {
              reason: { type: 'STRING', description: 'Powód pilnego połączenia podany przez rozmówcę' }
            }
          }
        }] : []),
        {
          name: 'endCall',
          description: 'Kończy połączenie i odkłada słuchawkę po pożegnaniu. ZAWSZE podaj bogate, szczegółowe podsumowanie rozmowy z prefiksem intencji ([💼 Oferta/Doradztwo], [🚨 Zgłoszenie/Reklamacja], [📅 Rezerwacja], [📝 Wiadomość], [ℹ️ Ogólne]), głównym celem, dodatkowymi pytaniami rozmówcy oraz obiektywną oceną nastroju i zachowania (np. spokojny, poddenerwowany, używał wulgaryzmów) oraz imię rozmówcy.',
          parameters: {
            type: 'OBJECT',
            properties: {
              callSummary: {
                type: 'STRING',
                description: 'Szczegółowe podsumowanie z prefiksem intencji, głównymi ustaleniami, pytaniami pobocznymi oraz nastrojem i zachowaniem rozmówcy np. "[📅 Rezerwacja] Spotkanie w sprawie MDM 74 na wtorek 11:00. Dodatkowo pytał o: pompę ciepła i terminy. Nastrój i zachowanie: poddenerwowany, używał wulgaryzmów, po wyjaśnieniach spokojniejszy."'
              },
              callerName: {
                type: 'STRING',
                description: 'Imię lub nazwisko rozmówcy ustalone podczas rozmowy (jeśli padło)'
              }
            }
          }
        }
      ];
    }

    const allTools = [
      {
        name: 'verify_confidential_pin',
        description: 'Weryfikuje kod PIN do Wiedzy Poufnej i odblokowuje chronioną treść na poufne pytanie z Bazy Wiedzy.',
        parameters: {
          type: 'OBJECT',
          properties: {
            pin: { type: 'STRING', description: 'Kod PIN podyktowany przez rozmówcę (same cyfry)' },
            topic: { type: 'STRING', description: 'Temat lub pytanie poufne, o które pyta rozmówca' }
          },
          required: ['pin']
        }
      },
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
        description: 'Kończy połączenie telefoniczne i odkłada słuchawkę. Użyj tego narzędzia, gdy klient pożegna się, sprawa została załatwiona i nadszedł moment zakończenia rozmowy. ZAWSZE podaj bogate podsumowanie rozmowy z prefiksem intencji ([💼 Oferta/Cennik], [🚨 Reklamacja/Problem], [📅 Rezerwacja], [📝 Wiadomość], [ℹ️ Ogólne]), głównym celem, pytaniami pobocznymi oraz nastrojem i zachowaniem klienta (np. spokojny, poddenerwowany) oraz imię klienta.',
        parameters: {
          type: 'OBJECT',
          properties: {
            callSummary: {
              type: 'STRING',
              description: 'Szczegółowe podsumowanie z prefiksem intencji np. "[📅 Rezerwacja] Strzyżenie na piątek o 14:00. Dodatkowo pytał o: cennik koloryzacji i parking. Nastrój i zachowanie: spokojny i uprzejmy."'
            },
            callerName: {
              type: 'STRING',
              description: 'Imię lub nazwisko klienta (jeśli padło)'
            }
          }
        }
      },
      {
        name: 'transferCallToOwner',
        description: 'Wywołaj to narzędzie, jeśli dzwoni kontakt VIP/Rodzina z pilną sprawą i kategorycznie prosi o bezpośrednie połączenie z właścicielem.',
        parameters: {
          type: 'OBJECT',
          properties: {
            reason: { type: 'STRING', description: 'Powód pilnego połączenia podany przez rozmówcę' }
          }
        }
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
  public async checkAvailability(
    tenantId: string, 
    date: string, 
    serviceName: string, 
    durationMinutes: number, 
    preferredStaffName?: string, 
    bookingMode: string = "hourly", 
    numberOfNights?: number,
    callerRole: string = "GUEST",
    vipCategory?: string,
    allowPrioritySlots?: boolean
  ): Promise<string[]> {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const isTeam = tenant?.businessProfile === 'team' || tenant?.businessProfile === 'facility';

      const reqDate = parseWarsawDateTime(`${date}T00:00:00`);
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
        const originalDayOfWeek = new Date(`${date}T12:00:00Z`).getDay(); 
        const nextDate = new Date(reqDate.getTime() + 24 * 60 * 60 * 1000);

        const timeOffs = await prisma.timeOff.findMany({
          where: { tenantId, startDate: { lt: nextDate }, endDate: { gte: reqDate } }
        });

        // Sprawdź czy data przypada na święto państwowe, urlop lub dni wolne z AnnualEvents
        const parsedDate = new Date(`${date}T00:00:00Z`);
        const reqMonth = parsedDate.getUTCMonth() + 1; // 1-12
        const reqDay = parsedDate.getUTCDate();

        const annualEvents = await prisma.annualEvent.findMany({
          where: { tenantId }
        });

        const isAnnualHolidayOrVacation = annualEvents.some(ae => {
          const isHolidayCat = ['statutory', 'vacation', 'holiday'].includes(ae.category) || 
            /urlop|wolne|święto|swieto/i.test(ae.title);
          if (!isHolidayCat) return false;

          if (!ae.endMonth || !ae.endDay || (ae.endMonth === ae.month && ae.endDay === ae.day)) {
            return ae.month === reqMonth && ae.day === reqDay;
          }
          const startVal = ae.month * 100 + ae.day;
          const endVal = ae.endMonth * 100 + ae.endDay;
          const currVal = reqMonth * 100 + reqDay;
          if (startVal <= endVal) {
            return currVal >= startVal && currVal <= endVal;
          } else {
            return currVal >= startVal || currVal <= endVal;
          }
        });

        const hasGeneralTimeOff = timeOffs.some(t => t.staffId === null);
        const isOffDay = isAnnualHolidayOrVacation || hasGeneralTimeOff;

        // Jeśli to salon i jest dzień wolny / urlop -> brak slotów
        if (isOffDay && tenant?.businessProfile !== 'personal') {
          return [];
        }

        // Dla pakietu osobistego: na dni wolne, święta państwowe i urlop
        // automatycznie nakłada się reguła Niedzieli (dayKey = "0")
        const effectiveDayOfWeek = (isOffDay && tenant?.businessProfile === 'personal') 
          ? 0 
          : originalDayOfWeek;
        const dayOfWeek = effectiveDayOfWeek;

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

          if (tenant?.businessProfile === 'personal') {
            const pSchedule = (tenant?.personalSchedule as any) || {};
            const workStart = pSchedule.workStart || "08:00";
            const workEnd = pSchedule.workEnd || "16:00";
            const workDays: number[] = Array.isArray(pSchedule.workDays) ? pSchedule.workDays : [1, 2, 3, 4, 5];
            
            const privateStart = pSchedule.privateStart || "16:00";
            const privateEnd = pSchedule.privateEnd || "20:00";
            const privateDays: number[] = Array.isArray(pSchedule.privateDays) ? pSchedule.privateDays : [1, 2, 3, 4, 5, 6];
            
            const prioritySlots: Array<{ day: number; time: string }> = Array.isArray(pSchedule.prioritySlots) ? pSchedule.prioritySlots : [];
            const nightProtection = pSchedule.nightProtection !== false;
            const focusBlocks: Array<{ id?: string; name?: string; days: number[]; start: string; end: string; dayTimes?: Record<string, { start: string; end: string }> }> = 
              Array.isArray(pSchedule.focusBlocks) ? pSchedule.focusBlocks : [];
            
            const slotDate = new Date(currentSlot);
            const timeStr = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }).format(slotDate);
            
            // 0. Sprawdź czy termin koliduje z Czasem Skupienia & Lekcji (z uwzględnieniem godzin per-dzień i pełnego przedziału slotu)
            const isInFocusBlock = focusBlocks.some((fb: any) => {
              if (!Array.isArray(fb.days) || !fb.days.includes(effectiveDayOfWeek)) return false;
              const dt = fb.dayTimes?.[effectiveDayOfWeek] || fb.dayTimes?.[String(effectiveDayOfWeek)];
              const bStart = dt?.start || fb.start;
              const bEnd = dt?.end || fb.end;
              if (!bStart || !bEnd) return false;
              const blockStartMs = parseWarsawDateTime(`${date}T${bStart.padStart(5, '0')}:00`).getTime();
              const blockEndMs = parseWarsawDateTime(`${date}T${bEnd.padStart(5, '0')}:00`).getTime();
              return currentSlot < blockEndMs && slotEnd > blockStartMs;
            });

            // 1. Sprawdź czy to slot priorytetowy
            const isPrioritySlot = prioritySlots.some(ps => ps.day === effectiveDayOfWeek && ps.time === timeStr);
            
            let isAllowedTime = false;
            if (callerRole === 'OWNER') {
              isAllowedTime = true;
            } else if (isInFocusBlock) {
              // W Czasie Skupienia (lekcje, wykłady, sesje deep work) żaden slot nie może być zaoferowany osobom z zewnątrz
              isAllowedTime = false;
            } else if (isPrioritySlot) {
              // Dostępny tylko jeśli rozmówca ma uprawnienie do terminów priorytetowych
              isAllowedTime = callerRole === 'VIP' && Boolean(allowPrioritySlots);
            } else {
              // Sprawdź czy to strefa pracy oraz strefa prywatna
              let isWorkTime = false;
              let isPrivateTime = false;

              const dayKey = String(effectiveDayOfWeek);
              if (pSchedule.days && (pSchedule.days[dayKey] || pSchedule.days[effectiveDayOfWeek])) {
                const dayConf = pSchedule.days[dayKey] || pSchedule.days[effectiveDayOfWeek];
                const workStartMs = parseWarsawDateTime(`${date}T${(dayConf.workStart || "08:00").padStart(5, '0')}:00`).getTime();
                const workEndMs = parseWarsawDateTime(`${date}T${(dayConf.workEnd || "16:00").padStart(5, '0')}:00`).getTime();
                isWorkTime = Boolean(dayConf.workEnabled) && currentSlot >= workStartMs && slotEnd <= workEndMs;

                const privateStartMs = parseWarsawDateTime(`${date}T${(dayConf.privateStart || "16:00").padStart(5, '0')}:00`).getTime();
                const privateEndMs = parseWarsawDateTime(`${date}T${(dayConf.privateEnd || "20:00").padStart(5, '0')}:00`).getTime();
                isPrivateTime = Boolean(dayConf.privateEnabled) && currentSlot >= privateStartMs && slotEnd <= privateEndMs;
              } else {
                // Kompatybilność wsteczna z dotychczasowym modelem
                const workStartMs = parseWarsawDateTime(`${date}T${(workStart || "08:00").padStart(5, '0')}:00`).getTime();
                const workEndMs = parseWarsawDateTime(`${date}T${(workEnd || "16:00").padStart(5, '0')}:00`).getTime();
                isWorkTime = workDays.includes(effectiveDayOfWeek) && currentSlot >= workStartMs && slotEnd <= workEndMs;

                const privateStartMs = parseWarsawDateTime(`${date}T${(privateStart || "16:00").padStart(5, '0')}:00`).getTime();
                const privateEndMs = parseWarsawDateTime(`${date}T${(privateEnd || "20:00").padStart(5, '0')}:00`).getTime();
                isPrivateTime = privateDays.includes(effectiveDayOfWeek) && currentSlot >= privateStartMs && slotEnd <= privateEndMs;
              }
              
              if (isWorkTime) {
                // Strefa pracy dostępna dla każdego (goście, klienci, praca)
                isAllowedTime = true;
              } else if (isPrivateTime) {
                // Strefa prywatna dostępna tylko dla kontaktów prywatnych / rodziny / z prawem do priorytetu
                isAllowedTime = callerRole === 'VIP' && (vipCategory === 'Rodzina' || vipCategory === 'Prywatne' || Boolean(allowPrioritySlots));
              } else if (nightProtection && (timeStr >= "22:00" || timeStr < "07:00")) {
                isAllowedTime = false;
              }
            }
            
            if (isAllowedTime) {
              const conflict = appointments.some(a => {
                const aStart = a.startTime.getTime() - bufferMs;
                const aEnd = a.endTime.getTime() + bufferMs;
                return currentSlot < aEnd && slotEnd > aStart;
              });
              if (!conflict) hasSlot = true;
            }
          } else if (targetStaffIds.length > 0) {
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
   * Pobiera sekcję FAQ z bazy danych (domyślnie tylko wpisy publiczne, niepoufne)
   */
  public async getFAQ(tenantId: string, includeConfidential: boolean = false): Promise<{ question: string, answer: string }[]> {
    try {
      const faqs = await prisma.faqEntry.findMany({
        where: includeConfidential ? { tenantId } : { tenantId, isConfidential: false }
      });
      return faqs.map(f => ({ question: f.question, answer: f.answer }));
    } catch (error) {
      console.error('Błąd pobierania FAQ z DB:', error);
      return []; 
    }
  }

  /**
   * Pobiera listę tematów/pytań poufnych (BEZ ujawniania treści odpowiedzi!)
   */
  public async getConfidentialTopics(tenantId: string): Promise<string[]> {
    try {
      const faqs = await prisma.faqEntry.findMany({
        where: { tenantId, isConfidential: true },
        select: { question: true }
      });
      return faqs.map(f => f.question);
    } catch (error) {
      console.error('Błąd pobierania tematów poufnych z DB:', error);
      return [];
    }
  }

  /**
   * Weryfikuje PIN do wiedzy poufnej (domyślnie 7777, niezależny od PIN właściciela)
   */
  public async verifyConfidentialPin(tenantId: string, pin: string, topic?: string): Promise<{ success: boolean; message: string; answer?: string; allUnlockedAnswers?: { question: string, answer: string }[] }> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { confidentialPin: true }
      });
      const validPin = tenant?.confidentialPin?.trim() || '7777';
      const cleanPin = String(pin || '').replace(/\D/g, '');

      if (cleanPin !== validPin) {
        return {
          success: false,
          message: "Podany kod PIN do wiedzy poufnej jest niepoprawny. Odmowa dostępu do informacji."
        };
      }

      // Poprawny PIN - pobierz poufne wpisy
      const confidentialEntries = await prisma.faqEntry.findMany({
        where: { tenantId, isConfidential: true }
      });

      if (topic) {
        const lowerTopic = topic.toLowerCase();
        const matched = confidentialEntries.find(e => 
          e.question.toLowerCase().includes(lowerTopic) || lowerTopic.includes(e.question.toLowerCase())
        );
        if (matched) {
          return {
            success: true,
            message: "PIN poprawny. Dostęp do wiedzy poufnej przyznany.",
            answer: `Odpowiedź na pytanie "${matched.question}": ${matched.answer}`
          };
        }
      }

      const allAnswersText = confidentialEntries.map(e => `[Poufne - ${e.question}]: ${e.answer}`).join('\n');
      return {
        success: true,
        message: "PIN poprawny. Autoryzacja pomyślna. Odblokowano wiedzę poufną.",
        answer: allAnswersText || "Brak zdefiniowanych dodatkowych wpisów poufnych.",
        allUnlockedAnswers: confidentialEntries.map(e => ({ question: e.question, answer: e.answer }))
      };
    } catch (error) {
      console.error('Błąd weryfikacji PIN wiedzy poufnej:', error);
      return { success: false, message: "Wystąpił błąd podczas weryfikacji PIN." };
    }
  }

  /**
   * Weryfikuje kod PIN Właściciela (dostęp do trybu zarządczego, kalendarza i podsumowań)
   */
  public async verifyOwnerPin(tenantId: string, pin: string): Promise<{ success: boolean; message: string }> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { pinCode: true }
      });
      const validPin = tenant?.pinCode?.trim() || '7777';
      const cleanPin = String(pin || '').replace(/\D/g, '');

      if (cleanPin === validPin) {
        return {
          success: true,
          message: "Kod PIN Właściciela poprawny. Tryb zarządczy i funkcje właścicielskie zostały odblokowane."
        };
      } else {
        return {
          success: false,
          message: "Niepoprawny kod PIN Właściciela. Odmowa autoryzacji."
        };
      }
    } catch (error) {
      console.error('Błąd weryfikacji PIN Właściciela:', error);
      return { success: false, message: "Wystąpił błąd podczas sprawdzania PIN." };
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
    callerPhone?: string,
    contactLevel?: string,
    callerRole: string = "GUEST",
    vipCategory?: string,
    allowPrioritySlots?: boolean
  ): Promise<boolean> {
    try {
      // Jeśli LLM przekazał niekompletny/błędny numer telefonu, a mamy Caller ID (callerPhone), użyj Caller ID
      let effectivePhone = (customerPhone || '').trim();
      if (callerPhone) {
        const cleanCaller = callerPhone.replace(/[\s\-\+]/g, '');
        const cleanProvided = effectivePhone.replace(/[\s\-\+]/g, '');
        if ((!cleanProvided || cleanProvided.length < 9) && cleanCaller.length >= 9) {
          effectivePhone = callerPhone.trim();
        }
      }
      customerPhone = effectivePhone;

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

      // Precyzyjne parsowanie w strefie czasowej Europe/Warsaw
      const startDate = parseWarsawDateTime(startTime);
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
          // Dla profilu osobistego (businessProfile === 'personal') - rygorystyczna ochrona czasu skupienia, godzin pracy i dni wolnych
          if (tenant?.businessProfile === 'personal') {
            const pSchedule = (tenant?.personalSchedule as any) || {};
            const reqDateStrLocal = startDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
            const originalDayOfWeek = new Date(`${reqDateStrLocal}T12:00:00Z`).getDay();

            // Sprawdź czy data przypada na święto państwowe, urlop lub dni wolne z AnnualEvents
            const parsedDate = new Date(`${reqDateStrLocal}T00:00:00Z`);
            const reqMonth = parsedDate.getUTCMonth() + 1;
            const reqDay = parsedDate.getUTCDate();

            const annualEvents = await prisma.annualEvent.findMany({ where: { tenantId } });
            const isAnnualHolidayOrVacation = annualEvents.some(ae => {
              const isHolidayCat = ['statutory', 'vacation', 'holiday'].includes(ae.category) || 
                /urlop|wolne|święto|swieto/i.test(ae.title);
              if (!isHolidayCat) return false;
              if (!ae.endMonth || !ae.endDay || (ae.endMonth === ae.month && ae.endDay === ae.day)) {
                return ae.month === reqMonth && ae.day === reqDay;
              }
              const startVal = ae.month * 100 + ae.day;
              const endVal = ae.endMonth * 100 + ae.endDay;
              const currVal = reqMonth * 100 + reqDay;
              return startVal <= endVal ? (currVal >= startVal && currVal <= endVal) : (currVal >= startVal || currVal <= endVal);
            });

            const timeOffs = await prisma.timeOff.findMany({
              where: { tenantId, startDate: { lt: endDate }, endDate: { gt: startDate } }
            });
            const hasGeneralTimeOff = timeOffs.some(t => t.staffId === null);
            const isOffDay = isAnnualHolidayOrVacation || hasGeneralTimeOff;
            const effectiveDayOfWeek = isOffDay ? 0 : originalDayOfWeek;

            // 1. Ochrona Czasu Skupienia & Lekcji (Focus Blocks)
            const focusBlocks: Array<{ id?: string; name?: string; days: number[]; start: string; end: string; dayTimes?: Record<string, { start: string; end: string }> }> = 
              Array.isArray(pSchedule.focusBlocks) ? pSchedule.focusBlocks : [];

            for (const fb of focusBlocks) {
              if (!Array.isArray(fb.days) || !fb.days.includes(effectiveDayOfWeek)) continue;
              const dt = fb.dayTimes?.[effectiveDayOfWeek] || fb.dayTimes?.[String(effectiveDayOfWeek)];
              const bStart = dt?.start || fb.start;
              const bEnd = dt?.end || fb.end;
              if (!bStart || !bEnd) continue;

              const blockStartMs = parseWarsawDateTime(`${reqDateStrLocal}T${bStart.padStart(5, '0')}:00`).getTime();
              const blockEndMs = parseWarsawDateTime(`${reqDateStrLocal}T${bEnd.padStart(5, '0')}:00`).getTime();

              if (startDate.getTime() < blockEndMs && endDate.getTime() > blockStartMs) {
                throw new Error(`KRYTYCZNY BŁĄD: Wybrany termin (${startTime}) koliduje z chronionym blokiem '${fb.name || 'Czas Skupienia / Lekcje'}' (${bStart}-${bEnd})! Właściciel nie może w tym czasie odbywać spotkań. Wywołaj narzędzie 'checkAvailability', aby pobrać dostępne wolne godziny i zaproponuj rozmówcy inny termin.`);
              }
            }

            // 2. Weryfikacja godzin pracy i strefy prywatnej
            if (callerRole !== 'OWNER') {
              const dayKey = String(effectiveDayOfWeek);
              if (pSchedule.days && (pSchedule.days[dayKey] || pSchedule.days[effectiveDayOfWeek])) {
                const dayConf = pSchedule.days[dayKey] || pSchedule.days[effectiveDayOfWeek];
                if (!dayConf.workEnabled && !dayConf.privateEnabled) {
                  throw new Error(`KRYTYCZNY BŁĄD: W tym dniu (${reqDateStrLocal}) właściciel ma dzień wolny od spotkań. Użyj narzędzia 'checkAvailability', aby zaproponować wolny dzień.`);
                }
                const workStartMs = parseWarsawDateTime(`${reqDateStrLocal}T${(dayConf.workStart || "08:00").padStart(5, '0')}:00`).getTime();
                const workEndMs = parseWarsawDateTime(`${reqDateStrLocal}T${(dayConf.workEnd || "16:00").padStart(5, '0')}:00`).getTime();
                const isWithinWork = Boolean(dayConf.workEnabled) && startDate.getTime() >= workStartMs && endDate.getTime() <= workEndMs;

                const privateStartMs = parseWarsawDateTime(`${reqDateStrLocal}T${(dayConf.privateStart || "16:00").padStart(5, '0')}:00`).getTime();
                const privateEndMs = parseWarsawDateTime(`${reqDateStrLocal}T${(dayConf.privateEnd || "20:00").padStart(5, '0')}:00`).getTime();
                const isWithinPrivate = Boolean(dayConf.privateEnabled) && startDate.getTime() >= privateStartMs && endDate.getTime() <= privateEndMs;

                const isPriorityAllowed = callerRole === 'VIP' && (vipCategory === 'Rodzina' || vipCategory === 'Prywatne' || Boolean(allowPrioritySlots));

                if (!isWithinWork && !(isWithinPrivate && isPriorityAllowed)) {
                  throw new Error(`KRYTYCZNY BŁĄD: Podana godzina (${startTime}) wykracza poza dozwolone godziny spotkań (${dayConf.workStart || "08:00"} - ${dayConf.workEnd || "16:00"}). Wywołaj narzędzie 'checkAvailability', aby zaproponować wolny termin.`);
                }
              }
            }
          }

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
            throw new Error(`KRYTYCZNY BŁĄD: Podany termin (${startTime}) jest już zajęty! Użyj narzędzia 'checkAvailability', aby sprawdzić wolne terminy.`);
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
          callerPhone: callerPhone || null,
          contactLevel: contactLevel || 'MEETING'
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


      // 4. Wyślij powiadomienie SMS o potwierdzeniu z możliwością anulowania (tylko dla salonów)
      if (tenant?.businessProfile !== 'personal') {
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
      }

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
      let fromDate = new Date(now);
      fromDate.setHours(0, 0, 0, 0);
      let toDate: Date | undefined = undefined;

      if (timeRange === "YESTERDAY") {
        fromDate.setDate(fromDate.getDate() - 1);
        toDate = new Date(fromDate);
        toDate.setHours(23, 59, 59, 999);
      } else if (timeRange === "THIS_WEEK") {
        const day = fromDate.getDay();
        const diff = fromDate.getDate() - day + (day === 0 ? -6 : 1); // od poniedziałku
        fromDate.setDate(diff);
      }

      const dateFilter: any = { gte: fromDate };
      if (toDate) {
        dateFilter.lte = toDate;
      }

      const [callLogs, appointments] = await Promise.all([
        prisma.callLog.findMany({
          where: {
            tenantId,
            callerRole: { not: 'OWNER' },
            createdAt: dateFilter
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.appointment.findMany({
          where: {
            tenantId,
            startTime: dateFilter,
            status: { not: 'cancelled' }
          },
          orderBy: { startTime: 'asc' },
          include: { service: true }
        })
      ]);

      const formatWarsawTime = (d: Date) => {
        return new Intl.DateTimeFormat('pl-PL', {
          timeZone: 'Europe/Warsaw',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(d));
      };

      const formatWarsawDateTime = (d: Date) => {
        return new Intl.DateTimeFormat('pl-PL', {
          timeZone: 'Europe/Warsaw',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(d));
      };

      const urgentCalls = callLogs.filter(c => c.urgency === 'HIGH' || c.urgency === 'CRITICAL' || (c.summary && c.summary.includes('[🚨')));
      const messagesWaiting = callLogs.filter(c => c.isMessageLeft);
      const otherCompletedCalls = callLogs.filter(c => !c.isMessageLeft && !(c.urgency === 'HIGH' || c.urgency === 'CRITICAL'));

      return {
        timeRange,
        totalCalls: callLogs.length,
        urgentCount: urgentCalls.length,
        messagesCount: messagesWaiting.length,
        appointmentsCount: appointments.length,
        // 1. Sprawy pilne (najwyższy priorytet do natychmiastowego oddzwonienia)
        urgentCalls: urgentCalls.map(c => ({
          callerName: c.callerName || 'Nieznany',
          callerPhone: c.callerPhone,
          time: formatWarsawTime(c.createdAt),
          urgency: c.urgency,
          summary: c.summary || 'Pilna sprawa bez notatki',
          action: c.actionItems || 'Wymagany pilny kontakt telefoniczny'
        })),
        // 2. Wiadomości zostawione dla właściciela
        messages: messagesWaiting.map(m => ({
          callerName: m.callerName || 'Nieznany',
          callerPhone: m.callerPhone,
          time: formatWarsawTime(m.createdAt),
          summary: m.summary || 'Zostawiono wiadomość',
          action: m.actionItems || 'Prośba o kontakt'
        })),
        // 3. Pozostałe przeprowadzone rozmowy z podsumowaniami (oferty, doradztwo, zapytania)
        completedCalls: otherCompletedCalls.map(c => ({
          callerName: c.callerName || 'Nieznany',
          callerPhone: c.callerPhone,
          time: formatWarsawTime(c.createdAt),
          durationSeconds: c.durationSeconds,
          summary: c.summary || 'Krótka rozmowa zakończona'
        })),
        // 4. Spotkania z kalendarza
        upcomingAppointments: appointments.map(a => ({
          client: a.customerName,
          phone: a.customerPhone,
          start: formatWarsawDateTime(a.startTime),
          topic: a.service?.name || a.callSummary || 'Spotkanie'
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
  public async sendSummaryEmail(tenantId: string, subject: string, contentMarkdown: string, timeRange: string = "TODAY") {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { annualEvents: true }
      });
      const email = tenant?.contactEmail || tenant?.betaContactEmail;
      if (!email) {
        return { error: "Brak skonfigurowanego adresu e-mail w Twoim profilu. Uzupełnij e-mail w Ustawieniach." };
      }

      // 1. Pobieramy pełne, zsynchronizowane dane z bazy za dany okres
      const activity: any = await this.getOwnerActivitySummary(tenantId, timeRange);
      const ownerName = (tenant.personalSchedule as any)?.ownerName || tenant.name || 'Właścicielu';
      const year = new Date().getFullYear();

      // 2. Formatujemy sekcję PILNE SPRAWY
      let urgentSectionHtml = '';
      if (activity.urgentCalls && activity.urgentCalls.length > 0) {
        const rows = activity.urgentCalls.map((c: any) => `
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
            <div style="margin-bottom: 6px;">
              <strong style="color: #991b1b; font-size: 15px;">${c.callerName}</strong>
              <span style="font-size: 12px; color: #b91c1c; background: #fee2e2; padding: 2px 8px; border-radius: 12px; font-weight: bold; margin-left: 8px;">🚨 PILNE (${c.time})</span>
            </div>
            <div style="margin-bottom: 6px;">
              <a href="tel:${c.callerPhone}" style="color: #b91c1c; font-weight: 600; text-decoration: underline; font-size: 14px;">📞 ${c.callerPhone}</a>
            </div>
            <div style="font-size: 13px; color: #374151; line-height: 1.5;">${c.summary}</div>
            ${c.action ? `<div style="font-size: 12px; color: #6b7280; margin-top: 6px; font-style: italic;">Sugerowane działanie: ${c.action}</div>` : ''}
          </div>
        `).join('');

        urgentSectionHtml = `
          <div style="margin-top: 24px;">
            <div style="font-size: 16px; font-weight: bold; color: #991b1b; margin-bottom: 12px;">
              🚨 Pilne Sprawy i Prośby o Kontakt (${activity.urgentCalls.length})
            </div>
            ${rows}
          </div>
        `;
      }

      // 3. Formatujemy sekcję POZOSTAŁE WIADOMOŚCI
      let messagesSectionHtml = '';
      if (activity.messages && activity.messages.length > 0) {
        const nonUrgentMessages = activity.messages.filter((m: any) => !activity.urgentCalls?.some((u: any) => u.callerPhone === m.callerPhone && u.time === m.time));
        if (nonUrgentMessages.length > 0) {
          const rows = nonUrgentMessages.map((m: any) => `
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
              <div style="margin-bottom: 4px;">
                <strong style="color: #1e3a8a; font-size: 14px;">${m.callerName}</strong>
                <span style="font-size: 12px; color: #64748b; margin-left: 8px;">(${m.time})</span>
              </div>
              <div style="margin-bottom: 4px;">
                <a href="tel:${m.callerPhone}" style="color: #2563eb; font-size: 13px; text-decoration: underline;">📞 ${m.callerPhone}</a>
              </div>
              <div style="font-size: 13px; color: #334155; line-height: 1.4;">${m.summary}</div>
            </div>
          `).join('');

          messagesSectionHtml = `
            <div style="margin-top: 20px;">
              <div style="font-size: 15px; font-weight: bold; color: #1e3a8a; margin-bottom: 10px;">
                📩 Zostawione Wiadomości (${nonUrgentMessages.length})
              </div>
              ${rows}
            </div>
          `;
        }
      }

      // 4. Formatujemy sekcję POŁĄCZENIA I ROZMOWY
      let completedCallsSectionHtml = '';
      if (activity.completedCalls && activity.completedCalls.length > 0) {
        const rows = activity.completedCalls.map((c: any) => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; font-size: 13px; color: #64748b; white-space: nowrap; vertical-align: top;">${c.time}</td>
            <td style="padding: 10px 8px; font-size: 13px; vertical-align: top; white-space: nowrap;">
              <strong style="color: #1e293b; display: block;">${c.callerName}</strong>
              <a href="tel:${c.callerPhone}" style="color: #64748b; font-size: 12px; text-decoration: none;">${c.callerPhone}</a>
            </td>
            <td style="padding: 10px 8px; font-size: 13px; color: #334155; line-height: 1.4; vertical-align: top;">
              ${c.summary}
            </td>
          </tr>
        `).join('');

        completedCallsSectionHtml = `
          <div style="margin-top: 24px;">
            <div style="font-size: 15px; font-weight: bold; color: #334155; margin-bottom: 10px;">
              📞 Pozostałe Rozmowy i Konsultacje (${activity.completedCalls.length})
            </div>
            <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left;">
                  <th style="padding: 8px; font-size: 12px; color: #64748b; width: 60px;">Czas</th>
                  <th style="padding: 8px; font-size: 12px; color: #64748b; width: 140px;">Rozmówca</th>
                  <th style="padding: 8px; font-size: 12px; color: #64748b;">Temat i Ustalenia</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        `;
      }

      // 5. Formatujemy sekcję SPOTKANIA W KALENDARZU
      let appointmentsSectionHtml = '';
      if (activity.upcomingAppointments && activity.upcomingAppointments.length > 0) {
        const rows = activity.upcomingAppointments.map((a: any) => `
          <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
            <div style="margin-bottom: 4px;">
              <strong style="color: #166534; font-size: 14px;">${a.start} • ${a.client}</strong>
            </div>
            <div style="margin-bottom: 4px;">
              <a href="tel:${a.phone}" style="color: #15803d; font-size: 13px; text-decoration: underline;">📞 ${a.phone}</a>
            </div>
            <div style="font-size: 13px; color: #334155;">Temat: ${a.topic}</div>
          </div>
        `).join('');

        appointmentsSectionHtml = `
          <div style="margin-top: 24px;">
            <div style="font-size: 15px; font-weight: bold; color: #166534; margin-bottom: 10px;">
              📅 Spotkania w Kalendarzu (${activity.upcomingAppointments.length})
            </div>
            ${rows}
          </div>
        `;
      }

      // Komentarz asystenta
      const commentaryHtml = contentMarkdown ? `
        <div style="background: #fdfbf7; border: 1px solid #fef3c7; border-radius: 10px; padding: 14px 16px; margin: 16px 0; font-size: 14px; line-height: 1.6;">
          <div style="font-weight: bold; margin-bottom: 4px; color: #78350f;">💬 Komentarz Asystenta AI:</div>
          <div style="white-space: pre-line; color: #451a03;">${contentMarkdown}</div>
        </div>
      ` : '';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
            .container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 28px 24px; text-align: left; }
            .content { padding: 24px; }
            .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
            .btn { display: inline-block; background-color: #0f172a; color: #ffffff !important; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px;">Raport Wykonawczy na Żądanie</div>
              <h1 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">${subject}</h1>
              <div style="font-size: 13px; color: #cbd5e1; margin-top: 6px;">Przygotowane dla: ${ownerName}</div>
            </div>
            <div class="content">
              ${commentaryHtml}
              
              <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 100px; background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 20px; font-weight: bold; color: #0f172a;">${activity.totalCalls || 0}</div>
                  <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Połączeń</div>
                </div>
                <div style="flex: 1; min-width: 100px; background: #fef2f2; padding: 10px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 20px; font-weight: bold; color: #dc2626;">${activity.urgentCount || 0}</div>
                  <div style="font-size: 11px; color: #b91c1c; text-transform: uppercase;">Pilnych</div>
                </div>
                <div style="flex: 1; min-width: 100px; background: #f0fdf4; padding: 10px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 20px; font-weight: bold; color: #16a34a;">${activity.appointmentsCount || 0}</div>
                  <div style="font-size: 11px; color: #15803d; text-transform: uppercase;">Spotkań</div>
                </div>
              </div>

              ${urgentSectionHtml}
              ${messagesSectionHtml}
              ${completedCallsSectionHtml}
              ${appointmentsSectionHtml}

              <div style="text-align: center; margin-top: 24px;">
                <a href="https://beautyvoice-bff.web.app/dashboard" class="btn">Otwórz Panel Zarządzania</a>
              </div>
            </div>
            <div class="footer">
              Wygenerowano przez Osobistego Asystenta AI • Veritas Platform &copy; ${year}
            </div>
          </div>
        </body>
        </html>
      `;

      const { EmailService } = await import('./email/EmailService');
      const sent = await EmailService.sendEmail(email, subject, html, contentMarkdown);

      // Dodatkowo wysyłamy powiadomienie Push do telefonu właściciela
      if (tenant.fcmTokens && tenant.fcmTokens.length > 0) {
        try {
          const { PushService } = await import('./PushService');
          await PushService.sendNotification(
            tenant.fcmTokens,
            `📊 ${subject}`,
            `Szczegółowy raport (${activity.totalCalls} połączeń, ${activity.urgentCount} pilnych) został wysłany na Twój e-mail (${email}).`,
            'https://beautyvoice-bff.web.app/dashboard'
          );
        } catch (pushErr) {
          console.error('[sendSummaryEmail] Błąd wysyłki Push:', pushErr);
        }
      }

      return { success: sent, message: sent ? `Szczegółowy raport z numerami i podsumowaniami został wysłany na Twój e-mail (${email}) oraz powiadomienie na telefon.` : "Błąd podczas wysyłki wiadomości e-mail." };
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

      // Jeśli dzwoniący prosi o kontakt / oddzwonienie, automatycznie dodaj zadanie telefonu do kalendarza właściciela
      if (callbackRequested) {
        try {
          const now = new Date();
          const startMin = Math.ceil(now.getMinutes() / 15) * 15;
          const taskStart = new Date(now);
          taskStart.setMinutes(startMin, 0, 0);
          const taskEnd = new Date(taskStart.getTime() + 15 * 60000);

          let service = await prisma.service.findFirst({
            where: { tenantId, name: { contains: 'Telefon', mode: 'insensitive' } }
          }) || await prisma.service.findFirst({ where: { tenantId } });

          await prisma.appointment.create({
            data: {
              tenantId,
              customerName: `📞 Oddzwonić: ${callerName || 'Rozmówca'}`,
              customerPhone: callerPhone || '',
              callerPhone: callerPhone || '',
              serviceId: service?.id || null,
              startTime: taskStart,
              endTime: taskEnd,
              status: 'confirmed',
              contactLevel: 'CALL',
              notes: rawMessage,
              callSummary: rawMessage,
              actionItems: callbackRequested ? 'Prośba o pilny kontakt telefoniczny' : undefined,
              callDuration: 0,
              isProcessed: false,
              callLogId: callLog.id
            }
          });
        } catch (calErr) {
          console.error('[BookingService] Błąd tworzenia zadania telefonu w kalendarzu:', calErr);
        }
      }

      return { success: true, message: "Wiadomość została zapisana, przekazana właścicielowi w powiadomieniu oraz wpisana do kalendarza jako telefon do wykonania." };
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
