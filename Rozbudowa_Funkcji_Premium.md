# Specyfikacja Zadania: Rozbudowa Funkcji Premium (EVA Outbound & Mini-CRM)

## 1. Cel i Kontekst Projektu
Aplikacja **EasyVoiceAssistant (EVA)** obsługuje obecnie ruch przychodzący (inbound) – wirtualną recepcję w chmurze, przekierowania połączeń, identyfikację Caller ID oraz automatyczną wysyłkę powiadomień SMS i tarczy anty-noshow (obsługa komendy "ANULUJE").

**Cel zadania:** Rozbudować moduł subskrypcji **Premium** o system aktywnych działań wychodzących (Outbound) z poziomu interfejsu czatu z asystentem oraz powiązany moduł skategoryzowanej bazy klientów (Mini-CRM).

---

## 2. Kluczowe Wymagania Funkcjonalne

### A. Zakładka Bazy Klientów (Mini-CRM)
* **Pola encji klienta:** `id`, `name`, `phone_number`, `tags` (np. `#vip`, `#rzesy`, `#utracony`), `last_visit_at`, `notes`, `created_at`.
* **Automatyczne tagowanie:** Przypisywanie tagów na podstawie historii rezerwacji i danych z Caller ID.
* **Interfejs:** Tabela z multi-filtrowaniem po tagach, statusach i historii interakcji (połączenia, transkrypcje, SMS).

### B. Chat Operacyjny z Action Tools (Human-in-the-Loop)
Właściciel wydaje polecenia w języku naturalnym. LLM przetwarza intencję, wywołuje odpowiednie narzędzie (Function Calling) i generuje **Action Card (Kartę Akcji)** w czacie. Wysłanie SMS lub wykonanie połączenia następuje **wyłącznie po kliknięciu przycisku zatwierdzenia** przez użytkownika.

---

## 3. Definicje Narzędzi (Function Calling Schemas)

Zaimplementuj w warstwie backendu (obsługa modeli LLM) następujące schematy narzędzi:

### `create_informational_campaign`
Dla masowych i jednostkowych akcji promocyjnych, powiadomień o zniżkach lub informowania o dostępności towarów/usług.

```json
{
  "name": "create_informational_campaign",
  "description": "Przygotowuje kampanię informacyjną lub promocyjną (SMS / Voice) dla wybranej grupy lub pojedynczego klienta.",
  "parameters": {
    "type": "object",
    "properties": {
      "campaign_name": {
        "type": "string",
        "description": "Nazwa robocza kampanii"
      },
      "channel": {
        "type": "string",
        "enum": ["sms", "voice_call", "voice_with_sms_fallback"],
        "description": "Kanał dotarcia do klienta"
      },
      "audience_filters": {
        "type": "object",
        "properties": {
          "tags": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Lista tagów do wyfiltrowania odbiorców"
          },
          "last_visit_days_ago_min": {
            "type": "integer",
            "description": "Minimalna liczba dni od ostatniej wizyty klienta"
          },
          "individual_customer_ids": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Lista ID konkretnych klientów (dla akcji jednostkowych)"
          }
        }
      },
      "message_content": {
        "type": "string",
        "description": "Szablon wiadomości SMS lub instrukcja promptu dla Voice Bota z interpolacją {{first_name}}"
      },
      "scheduled_time": {
        "type": "string",
        "description": "Data ISO8601 lub 'now'"
      }
    },
    "required": ["channel", "audience_filters", "message_content"]
  }
}
schedule_confirmation_flow
Dla weryfikacji, potwierdzania lub odwoływania nadchodzących rezerwacji.
{
  "name": "schedule_confirmation_flow",
  "description": "Uruchamia interaktywny mechanizm potwierdzania rezerwacji z automatyczną obsługą dwukierunkową.",
  "parameters": {
    "type": "object",
    "properties": {
      "target_scope": {
        "type": "string",
        "enum": ["tomorrow_appointments", "specific_date", "single_booking"],
        "description": "Zakres rezerwacji podlegających potwierdzeniu"
      },
      "booking_ids": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Opcjonalna lista ID konkretnych rezerwacji"
      },
      "confirmation_method": {
        "type": "string",
        "enum": ["sms_two_way", "voice_interactive"],
        "description": "Metoda weryfikacji (SMS dwukierunkowy lub interaktywny Voice Bot)"
      },
      "voice_script_intent": {
        "type": "string",
        "description": "Kontekst rozmowy dla bota w razie próby przełożenia wizyty"
      },
      "hours_before_event": {
        "type": "integer",
        "description": "Czas wyprzedzenia akcji w godzinach (np. 24)"
      }
    },
    "required": ["target_scope", "confirmation_method"]
  }
}
4. Logika Biznesowa i Webhooki ZwrotneObsługa SMS Dwukierunkowego (Inbound SMS Webhook):Słowo kluczowe TAK / POTWIERDZAM $\rightarrow$ aktualizacja statusu rezerwacji w kalendarzu na CONFIRMED.Słowo kluczowe ANULUJE $\rightarrow$ zmiana statusu na CANCELLED, zwolnienie slotu w grafiku salonu oraz wysłanie notyfikacji push do właściciela[cite: 1].Inne odpowiedzi $\rightarrow$ przekazanie do skrzynki odbiorczej (Inbox) w panelu z oznaczeniem REQUIRES_ATTENTION.Outbound Voice Bot (Logika Połączeń Wychodzących):Wykorzystanie syntezy i rozpoznawania mowy w chmurze[cite: 1].Obsługa scenariusza Brak Odpowiedzi (No-Answer / Busy): automatyczny fallback na wiadomość SMS z linkiem do potwierdzenia lub rezerwacji.Restrykcje Bezpieczeństwa (Guardrails):Quiet Hours: Blokada wykonywania automatycznych połączeń i wysyłki masowej w godzinach 20:00–09:00.Rate Limiting / Pacing: Kolejkowanie zadań z interwałem min. 15–30 sekund między kolejnymi połączeniami wychodzącymi.5. Zadania Implementacyjne dla Agenta[ ] Utworzyć schemat bazy danych dla kolekcji customers, campaigns oraz outbound_queue.[ ] Zbudować endpointy REST / BFF do zarządzania segmentacją bazy klientów.[ ] Skonfigurować deklaracje narzędzi Function Calling w module czatu asystenta.[ ] Przygotować komponent UI Action Card renderowany w strumieniu czatu po wywołaniu narzędzia.[ ] Zaimplementować webhook obsługujący przychodzące wiadomości SMS z parserem komend statusowych (TAK/ANULUJE)[cite: 1].[ ] Dodać zabezpieczenia czasowe (Quiet Hours) w kolejce wysyłkowej.