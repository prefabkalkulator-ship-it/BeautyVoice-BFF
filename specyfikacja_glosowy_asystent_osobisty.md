# Specyfikacja Techniczna i Architektura: Głosowy Asystent Osobisty Profesjonalisty (Personal AI Voice Assistant)

## 1. Kontekst Projektu i Cel Rozszerzenia
Niniejszy dokument definiuje wymagania produktowe, specyfikację architektoniczną oraz schematy danych dla nowej gałęzi (modułu) systemu Voice AI.
Dotychczasowy system realizował scenariusze B2B dla podmiotów biznesowych (obsługa klientów firmy, recepcja, lead capture). Nowa gałąź stanowi **Głosowego Asystenta Osobistego dla Profesjonalistów** (architekci, inżynierowie oprogramowania, konsultanci, lekarze, menedżerowie).

Głównym celem modułu jest ochrona pracy głębokiej (*deep work*), eliminacja przełączania kontekstu (*context switching*), całodobowa obsługa połączeń przychodzących, dyskretne zarządzanie kalendarzem oraz automatyzacja podsumowań i asynchronicznej komunikacji z właścicielem konta.

---

## 2. Kluczowe Wymagania Funkcjonalne

### 2.1. Dynamiczna Baza Wiedzy o Użytkowniku (Profile & Context Engine)
* **Tożsamość:** Asystent wie, czyim jest asystentem, jaką rolę pełni właściciel oraz czym się zajmuje zawodowo.
* **Privacy Shield (Maska Dyskrecji):** Asystent ma wgląd w pełne dane kalendarza, ale w relacji z osobami trzecimi ujawnia wyłącznie status binarny (*zajęty / wolny*) lub ogólny (*„w tych godzinach ma zaplanowane inne zobowiązania”*). Nigdy nie ujawnia prywatnych tytułów (np. wizyta u lekarza, trening, sprawy urzędowe).
* **Filtrowanie spamu/akwizycji (Gatekeeping):** Asystent potrafi wykryć próby sprzedaży, telemarketingu lub zautomatyzowane boty i grzecznie, lecz stanowczo zakończyć rozmowę, nie eskalując notatek o niskim priorytecie.

### 2.2. Nieograniczona Lista VIP (VIP Directory & Tier Routing)
* **Brak limitu wpisów:** Użytkownik może zdefiniować dowolną liczbę numerów i kontaktów VIP.
* **Grupy / Kategoryzacja:** Rodzina, Przyjaciele, Zespół/Koledzy z pracy, Kluczowi Kontrahenci/Inwestorzy.
* **CRUD & Bulk Operations:** Pełna możliwość dodawania, edycji, usuwania pojedynczych numerów, zmiany grupy, a także importu/eksportu całej listy (np. CSV/JSON).
* **Reguły zachowania asystenta dla VIP:**
  * Specjalny, bardziej bezpośredni i ciepły ton komunikacji.
  * Dostęp do dedykowanych slotów rezerwacji (np. sloty priorytetowe niedostępne publicznie).
  * Natychmiastowy priorytetowy alert Push/SMS do właściciela z flagą `HIGH_PRIORITY`.
  * Opcjonalna funkcja *Warm Transfer* (przełączenie bezpośrednie na numer prywatny właściciela, jeśli reguła na to zezwala).

### 2.3. Kalendarz Wbudowany i Silnik Zdarzeń Cyklicznych (Calendar Engine)
* **Zdarzenia cykliczne pracy/odpoczynku:** Definiowanie powtarzalnych okresów niedostępności (codziennie, cotygodniowo, comiesięcznie, corocznie — np. urlopy, dyżury, praca w skupieniu, stałe bloki szkoleniowe/zabiegi).
* **Ważne wydarzenia w kalendarzu rocznym:**
  * Urodziny i rocznice bliskich (rodzina, przyjaciele).
  * Święta państwowe/branżowe oraz kluczowe daty w roku (terminy podatkowe, odnowienia licencji itp.).
  * Notyfikacje przypominające dla właściciela w raportach porannych.
* **Rezerwacja spotkań i bufor logistyczny:** Asystent weryfikuje wolne okna w czasie rzeczywistym i zapisuje spotkanie z dzwoniącym. Automatycznie uwzględnia konfigurowalny bufor (np. 15–30 min) między spotkaniami.

### 2.4. Obsługa Połączenia od Właściciela (Owner Executive Mode)
* **Rozpoznanie Tożsamości:** Identyfikacja po numerze CLI (Caller ID) + weryfikacja (np. kod PIN / biometria głosu / jednorazowy token).
* **Tryb Zarządczy (Executive Voice Interface):**
  * Zapytanie o podsumowanie z wybranego okresu (*„co się działo dzisiaj od 12:00?”, „jakie telefony były wczoraj?”, „podsumuj ostatni tydzień”*).
  * Możliwość zlecenia wysyłki tego raportu na e-mail w trakcie rozmowy (*„wyślij mi to na maila”*).
  * Dyktowanie szybkich notatek lub blokowanie terminów w kalendarzu głosem.

### 2.5. Komunikacja Asynchroniczna i Podsumowania (Notifications & Briefings)
* **Push Notifications po rozmowie:** 
  * Jeśli wiadomość od dzwoniącego była krótka: pełna treść.
  * Jeśli długa lub chaotyczna: automatyczna synteza (LLM Summarizer): Kto dzwonił | W jakiej sprawie | Oczekiwane działanie/Termin.
* **Codzienny Poranny E-mail (Morning Executive Briefing):**
  * Zestawienie i podsumowanie wydarzeń, telefonów oraz notatek z dnia wczorajszego.
  * Harmonogram spotkań na dzień bieżący.
  * Przypomnienia o ważnych datach rocznych na dzisiaj i najbliższe dni (urodziny bliskich, rocznice, terminy).

*(Uwaga: wykluczono funkcjonalność proaktywnego oddzwaniania/follow-up).*

---

## 3. Architektura Systemu i Komponenty

```
                        ┌─────────────────────────────────────────────────────────┐
                        │                   TELEPHONY INGESTION                   │
                        │   (PSTN / SIP Trunk -> WebSockets -> Audio Stream)      │
                        └───────────────────────────┬─────────────────────────────┘
                                                    │
                                                    ▼
                        ┌─────────────────────────────────────────────────────────┐
                        │              REAL-TIME ORCHESTRATION LAYER              │
                        │  - Silero VAD (Voice Activity Detection)                │
                        │  - STT Engine (Whisper / Google Chirp / Deepgram)       │
                        │  - TTS Engine (ElevenLabs / Google Speech / Cartesia)   │
                        └───────────────────────────┬─────────────────────────────┘
                                                    │
                                                    ▼
 ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                   AGENT CORE & STATE MACHINE                                  │
 │                                                                                               │
 │  ┌─────────────────────────┐    ┌─────────────────────────┐    ┌───────────────────────────┐  │
 │  │      Router Dialu       │    │     Caller ID Match     │    │   Dynamic System Prompt   │  │
 │  │  Owner vs VIP vs Guest  │───▶│   (VIP Directory & DB)  │───▶│   - Identity & Bio        │  │
 │  └─────────────────────────┘    └─────────────────────────┘    │   - Privacy Masking       │  │
 │                                                                │   - Tool Definitions      │  │
 │                                                                └───────────────────────────┘  │
 │                                              │                                                │
 │                                              ▼                                                │
 │                                   ┌──────────────────────┐                                    │
 │                                   │     LLM ENGINE       │                                    │
 │                                   │   (Function Calling) │                                    │
 │                                   └──────────┬───────────┘                                    │
 └──────────────────────────────────────────────┼────────────────────────────────────────────────┘
                                                │
                ┌───────────────────────────────┴───────────────────────────────┐
                ▼                                                               ▼
 ┌─────────────────────────────┐                                 ┌─────────────────────────────┐
 │       TOOL EXECUTION        │                                 │    BACKGROUND DISPATCHER    │
 │ - `check_calendar_free_slots`                                 │ - Push Notification Worker  │
 │ - `book_calendar_appointment`                                 │ - Summarizer Worker (LLM)   │
 │ - `save_caller_message`                                       │ - Morning Briefing Cron     │
 │ - `query_owner_summary`                                       │ - SMTP / Email Transporter  │
 └─────────────────────────────┘                                 └─────────────────────────────┘
```

---

## 4. Model Danych (Przykładowy Schemat PostgreSQL / Prisma)

```prisma
// Profil Użytkownika i Konfiguracja Asystenta
model UserProfile {
  id                String            @id @default(uuid())
  phoneNumber       String            @unique
  fullName          String
  profession        String            // np. Architekt / Dev / Konsultant
  bioSummary        String            // Dynamiczna baza wiedzy wstrzykiwana do promptu
  ownerPinHash      String?           // Opcjonalny PIN do autoryzacji w trybie właściciela
  timezone          String            @default("Europe/Warsaw")
  email             String            @unique
  
  // Relacje
  vipContacts       VipContact[]
  calendarEvents    CalendarEvent[]
  callLogs          CallLog[]
  annualEvents      AnnualEvent[]
  settings          AssistantSettings?
}

// Baza VIP bez ograniczeń
model VipContact {
  id                String       @id @default(uuid())
  userId            String
  user              UserProfile  @relation(fields: [userId], references: [id], onDelete: Cascade)
  phoneNumber       String       // Znormalizowany format E.164 (+48...)
  contactName       String
  category          VipCategory  // FAMILY, FRIEND, COWORKER, KEY_CLIENT
  customInstructions String?    // np. "Możesz łączyć bezpośrednio lub podać prywatny slot"
  allowPrioritySlots Boolean     @default(true)
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  @@unique([userId, phoneNumber])
  @@index([userId, phoneNumber])
}

enum VipCategory {
  FAMILY
  FRIEND
  COWORKER
  KEY_CLIENT
}

// Roczne ważne daty (urodziny, rocznice, podatki)
model AnnualEvent {
  id                String       @id @default(uuid())
  userId            String
  user              UserProfile  @relation(fields: [userId], references: [id], onDelete: Cascade)
  title             String       // np. "Urodziny Mamy", "Rocznica ślubu"
  month             Int          // 1 - 12
  day               Int          // 1 - 31
  category          String       // BIRTHDAY, ANNIVERSARY, TAX, HOLIDAY
  reminderDaysAhead Int          @default(1)
}

// Kalendarz Wbudowany z regułami powtarzalności (RRULE compliant)
model CalendarEvent {
  id                String       @id @default(uuid())
  userId            String
  user              UserProfile  @relation(fields: [userId], references: [id], onDelete: Cascade)
  title             String
  description       String?
  startAt           DateTime
  endAt             DateTime
  isAllDay          Boolean      @default(false)
  isPrivate         Boolean      @default(true) // Privacy Shield: asystent nie zdradza nazwy
  recurrenceRule    String?      // Standard iCal RRULE (np. "FREQ=WEEKLY;BYDAY=TU,TH")
  bookedByPhone     String?      // Wypełniane, gdy spotkanie umówił asystent
  status            EventStatus  @default(CONFIRMED)
}

enum EventStatus {
  CONFIRMED
  TENTATIVE
  CANCELLED
}

// Rejestr Połączeń i Wiadomości
model CallLog {
  id                String       @id @default(uuid())
  userId            String
  user              UserProfile  @relation(fields: [userId], references: [id], onDelete: Cascade)
  callerPhone       String
  callerRole        CallerRole   // OWNER, VIP, UNKNOWN, SPAM
  startedAt         DateTime     @default(now())
  durationSeconds   Int
  transcript        String       @db.Text
  summary           String?      @db.Text // Skrót wygenerowany przez LLM
  actionItems       String?      // Konkretne oczekiwania / termin oddzwonienia
  isMessageLeft     Boolean      @default(false)
  pushSent          Boolean      @default(false)
  isProcessed       Boolean      @default(false)
}

enum CallerRole {
  OWNER
  VIP
  UNKNOWN
  SPAM
}
```

---

## 5. Definicja Narzędzi Agenta (Function Calling Schema)

Agent LLM podczas aktywnej sesji głosowej posiada dostęp do następujących narzędzi:

```json
[
  {
    "name": "check_calendar_availability",
    "description": "Sprawdza wolne okna czasowe w kalendarzu użytkownika na dany dzień lub zakres dni, z uwzględnieniem prywatności i buforów.",
    "parameters": {
      "type": "object",
      "properties": {
        "startDate": { "type": "string", "format": "date", "description": "YYYY-MM-DD" },
        "endDate": { "type": "string", "format": "date", "description": "YYYY-MM-DD" },
        "durationMinutes": { "type": "integer", "default": 30 }
      },
      "required": ["startDate"]
    }
  },
  {
    "name": "book_appointment",
    "description": "Rezerwuje termin w kalendarzu po uzgodnieniu z dzwoniącym.",
    "parameters": {
      "type": "object",
      "properties": {
        "startDateTime": { "type": "string", "format": "date-time", "description": "ISO 8601 string" },
        "durationMinutes": { "type": "integer" },
        "callerName": { "type": "string" },
        "topic": { "type": "string" }
      },
      "required": ["startDateTime", "durationMinutes", "callerName"]
    }
  },
  {
    "name": "save_call_message",
    "description": "Zapisuje wiadomość od dzwoniącego, generuje skrót i wyzwala natychmiastowe powiadomienie Push do właściciela.",
    "parameters": {
      "type": "object",
      "properties": {
        "callerName": { "type": "string" },
        "rawMessage": { "type": "string" },
        "urgency": { "type": "string", "enum": ["LOW", "NORMAL", "HIGH", "CRITICAL"] },
        "callbackRequested": { "type": "boolean" }
      },
      "required": ["callerName", "rawMessage", "urgency"]
    }
  },
  {
    "name": "get_owner_activity_summary",
    "description": "Wywoływane WYŁĄCZNIE gdy dzwoni WŁAŚCICIEL. Zwraca zagregowane podsumowanie połączeń, wiadomości i zaplanowanych spotkań ze wskazanego okresu.",
    "parameters": {
      "type": "object",
      "properties": {
        "timeRange": { 
          "type": "string", 
          "enum": ["TODAY", "YESTERDAY", "THIS_WEEK", "CUSTOM"], 
          "description": "Okres podsumowania" 
        },
        "fromDateTime": { "type": "string", "format": "date-time" },
        "toDateTime": { "type": "string", "format": "date-time" }
      },
      "required": ["timeRange"]
    }
  },
  {
    "name": "send_summary_email",
    "description": "Wywoływane na żądanie WŁAŚCICIELA podczas rozmowy. Wysyła aktualne zestawienie zdarzeń na zarejestrowany adres e-mail.",
    "parameters": {
      "type": "object",
      "properties": {
        "subject": { "type": "string" },
        "contentMarkdown": { "type": "string" }
      },
      "required": ["subject", "contentMarkdown"]
    }
  }
]
```

---

## 6. Wzorce Promptów Systemowych (System Prompt Matrix)

### 6.1. System Prompt dla Osób Trzecich i VIP
```markdown
Jesteś profesjonalnym, dyskretnym i uprzejmym Asystentem Osobistym.
Reprezentujesz użytkownika: {{fullName}}, który jest: {{profession}}.

Twoje cele:
1. Poinformuj dzwoniącego, czyim jesteś asystentem i w czym możesz pomóc.
2. Odpowiadaj zwięźle i naturalnie (rozmowa telefoniczna, zdania do 25 słów).
3. PRIVACY SHIELD: Jeśli użytkownik jest zajęty, powiedz jedynie: "{{fullName}} ma w tym czasie inne zaplanowane zobowiązania". Pod żadnym pozorem nie ujawniaj charakteru prywatnych spraw (np. lekarz, sprawy osobiste, urlop).
4. REZERWACJA: Jeśli dzwoniący chce się spotkać, użyj narzędzia `check_calendar_availability` i zaproponuj 2 konkretne sloty. Po wyborze wywołaj `book_appointment`.
5. WIADOMOŚĆ: Jeśli dzwoniący chce zostawić wiadomość, wysłuchaj go, dopytaj o nazwisko i numer, a po zakończeniu wywołaj `save_call_message`.
6. STATUS VIP: 
   Rozmówca oznaczony jako: {{callerVipStatus}} (Kategoria: {{callerCategory}}).
   Dla VIP zachowaj ciepły, bezpośredni ton. Jeśli kategoria to FAMILY/FRIEND, możesz podać dedykowane sloty lub poinformować, że wyślesz natychmiastowe powiadomienie z prośbą o pilny kontakt.
7. SPAM / AKWIZYCJA: Jeśli rozmówca prowadzi telemarketing lub ofertę handlową, podziękuj uprzejmie i zakończ rozmowę bez zapisywania notatki o wysokim priorytecie.
```

### 6.2. System Prompt dla Właściciela (Owner Executive Mode)
```markdown
Rozmawiasz ze swoim WŁAŚCICIELEM: {{fullName}}.
Rozpoznano numer telefonu.

Twoje cele:
1. Przywitaj się krótko i poinformuj, ile nieodebranych spraw i nowych wiadomości czeka na sprawdzenie.
2. Na pytanie o raport/podsumowanie, wywołaj natychmiast `get_owner_activity_summary` ze wskazanym zakresem czasu i zreferuj go w punktach (Kto, Cel, Pilność).
3. Jeśli właściciel powie "wyślij mi to na maila" lub "prześlij raport", sformatuj treść i wywołaj `send_summary_email`.
4. Możesz również przyjąć polecenie zablokowania czasu w kalendarzu lub zanotowania zadania.
```

---

## 7. Automatyzacja w Tle (Cron & Background Workers)

### 7.1. Codzienny Poranny Briefing E-mail (07:30 Local Time)
1. **Pobranie Danych:**
   * Połączenia i wiadomości z dnia poprzedniego (`yesterday 00:00` do `yesterday 23:59`).
   * Zdarzenia z kalendarza na dzień dzisiejszy (`today 00:00` do `today 23:59`).
   * Sprawdzenie tabeli `AnnualEvent` dla daty `today.month` i `today.day` (urodziny bliskich, rocznice, ważne daty).
2. **Generowanie Treści (LLM Worker):**
   * Struktura:
     * **1. Ważne Rocznice i Urodziny Dziś** (jeśli występują — wyróżnione na początku!).
     * **2. Podsumowanie Wczoraj** (odebrane telefony, załatwione sprawy, wiadomości oczekujące na odpowiedź).
     * **3. Twój Dzień Dzisiaj** (oś czasu spotkań, bloki pracy głębokiej, okna wolnego czasu).
3. **Wysyłka SMTP / Resend / SendGrid** w estetycznym szablonie HTML + Plaintext.

### 7.2. Natychmiastowy Push Notification Worker
* Wyzwalany natychmiast po rozłączeniu połączenia, w którym dzwoniący zostawił wiadomość (`save_call_message`).
* Paylod powiadomienia:
  * Tytuł: `[VIP - Rodzina] Mama` lub `[Nowa Wiadomość] Jan Kowalski`
  * Treść: Skondensowane podsumowanie w maks. 2 zdaniach.
  * Deep link: Bezpośrednie otwarcie szczegółów nagrania/transkrypcji w aplikacji webowej/PWA.

---

## 8. Wytyczne Implementacyjne dla Agenta Programistycznego
1. **Modułowość:** Rozszerz istniejący kontroler połączeń o middleware `CallerIdentificationMiddleware`, który przed inicjalizacją promptu sprawdza numer w bazie VIP oraz porównuje z numerem właściciela.
2. **Bezpieczeństwo Połączenia Właściciela:** Wprowadź opcjonalny mechanizm weryfikacji DTMF (kod PIN wbijany z klawiatury telefonu), jeśli połączenie z numeru właściciela ma dostęp do wrażliwych podsumowań.
3. **RRULE Parsing:** Do obsługi cyklicznych blokad kalendarza (cotygodniowe zabiegi, praca w skupieniu, coroczne urodziny) użyj sprawdzonej biblioteki (np. `rrule` w TypeScript/Node.js lub `dateutil.rrule` w Pythonie).
4. **Idempotencja Powiadomień:** Zabezpiecz worker wysyłki powiadomień flagami `pushSent` i `isProcessed` w `CallLog`, aby uniknąć duplikatów przy ponownych próbach webhooków VoIP.
