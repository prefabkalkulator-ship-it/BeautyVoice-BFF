# Zadanie Techniczne: Transformacja BeautyVoice-BFF do Wielodostępnej Platformy SaaS (BeautyVoice Platform v2)

## 1. Cel i Kontekst Projektu
Przekształć dotychczasowe pojedyncze MVP (BeautyVoice-BFF oparte o Google Sheets i Calendar per instancja) w pełnoprawną platformę SaaS (Multi-Tenant) typu Self-Serve z interfejsem PWA (Mobile-First).

System ma umożliwić właścicielom salonów (lub dowolnych punktów usługowych):
1. Samodzielną rejestrację, podpięcie karty płatniczej (Stripe) i wybór planu.
2. Zarządzanie bazą wiedzy (usługi, FAQ) oraz podgląd rozmów i rezerwacji w panelu PWA.
3. Automatyczną obsługę połączeń głosowych dla każdego salonu w oparciu o przypisany numer telefonu (Twilio/Vapi) i dedykowany kontekst.
4. (Moduł rozwojowy): Inteligentnego Asystenta Onboardingu Wiedzy, który przekształci surowe materiały (PDF, DOCX, linki YouTube, zdjęcia cenników) w ustrukturyzowany format JSON.

---

## 2. Kluczowe Zmiany Architektoniczne

### A. Przejście ze Statycznego Arkusza na Relacyjną Bazę Danych (PostgreSQL)
Dotychczasowy arkusz Google Sheets zastępujemy bazą danych z izolacją danych według `tenant_id`:
*   `tenants` (id, user_id, name, phone_number, forward_phone_number, created_at)
*   `subscriptions` (id, tenant_id, stripe_customer_id, stripe_subscription_id, plan_name, minutes_included, minutes_used, status)
*   `services` (id, tenant_id, name, price, duration_minutes, description)
*   `faq_entries` (id, tenant_id, question, answer, category)
*   `call_logs` (id, tenant_id, caller_phone, duration_seconds, status, transcript, cost_units, created_at)
*   `appointments` (id, tenant_id, customer_name, customer_phone, service_id, start_time, end_time, google_event_id, status)

### B. Dynamiczny Context Injection w Webhooku Głosowym
*   Dotychczasowy endpoint `POST /api/chat` (lub webhook Vapi) musi dynamicznie identyfikować najemcę:
    1. Pobranie numeru docelowego (`called_number`) lub `tenant_id` z nagłówka/payloadu zapytania.
    2. Pobranie z bazy danych cennika (`services`) i `faq_entries` powiązanych wyłącznie z tym `tenant_id`.
    3. Wstrzyknięcie pobranej wiedzy do instrukcji systemowej Gemini 3.5 Flash w czasie rzeczywistym.
    4. Wywołanie narzędzi (Function Calling: `checkAvailability`, `bookAppointment`) z autoryzacją do kalendarza właściwego salonu (OAuth2 refresh tokens lub dedykowany kalendarz).

---

## 3. Plan Implementacji dla Agenta Antigravity

### Krok 1: Warstwa Bazy Danych i Multi-Tenancy (BFF Core)
- Skonfiguruj schemat ORM (Prisma / Drizzle) dla PostgreSQL zgodnie z powyższym modelem relacyjnym.
- Stwórz mechanizm migracji danych z dotychczasowych Google Sheets do bazy PostgreSQL.
- Zaimplementuj middleware autoryzacji (JWT/Session) izolujący zapytania per `tenant_id`.

### Krok 2: Subskrypcje i Pomiary Zużycia (Stripe & Usage Billing)
- Zintegruj Stripe API (Stripe Checkout / Billing Portal / Webhooks).
- Zbuduj obsługę webhooka `POST /api/webhooks/vapi`:
  - Po zakończeniu rozmowy odbierz `call.ended`, zlicz czas trwania rozmowy w sekundach.
  - Zaktualizuj `call_logs` oraz pole `minutes_used` w rekordzie `subscriptions`.
  - Jeśli minuty przekraczają limit planu (Overage), nalicz mikropłatność za pośrednictwem Stripe Metered Billing.

### Krok 3: Przebudowa Webhooka Asystenta Głosowego
- Zaktualizuj endpoint obsługujący transkrypcję od orkiestratora głosowego (Vapi/Twilio):
  - Identyfikacja najemcy na podstawie numeru telefonu (`To` / `customer_number`).
  - Budowa dynamicznego kontekstu (Prompt + RAG z tabeli `services` i `faq_entries`).
  - Bezpieczne wywołanie narzędzia rezerwacji: obsługa tokenów OAuth2 Google Calendar powiązanych z danym `tenant_id`.

### Krok 4: Panel PWA Mobile-First (Frontend Simulator & Dashboard)
- Rozbuduj warstwę PWA (`frontend-simulator` / Next.js / Vite):
  - **Onboarding Flow:** Rejestracja -> Wybór Planu -> Podpięcie Karty (Stripe Elements) -> Przypisanie numeru telefonu.
  - **Zarządzanie Cennikiem i FAQ:** Interfejs CRUD umożliwiający dodawanie, usuwanie i edycję usług oraz pytań do bazy wiedzy w czasie rzeczywistym.
  - **Dashboard Połączeń:** Podgląd historii połączeń, transkrypcji z audio oraz statystyk wykorzystanych minut.
  - **Live Simulator:** Komponent audio do testowania rozmowy z asystentem w przeglądarce przed wdrożeniem produkcyjnym.

### Krok 5: Przygotowanie Pod Moduł Rozwojowy (Knowledge Ingestion Assistant)
- Zaprojektuj i przygotuj interfejsy/kontrolery pod asystenta onboardingu wiedzy:
  - Zdefiniuj serwis `KnowledgeExtractorService` z metodami:
    - `parseDocument(fileBuffer, mimeType)` (dla PDF/DOCX przy użyciu modeli multimodalnych Gemini).
    - `extractFromMedia(url)` (streszczanie wideo/audio do struktury FAQ).
    - `generateStructuredKnowledge(rawText)` -> zwraca JSON ze schematem `services` i `faq_entries` gotowy do zatwierdzenia przez użytkownika przed zapisem do bazy.

---

## 4. Wytyczne Uruchomieniowe

1. Rozpocznij od **Kroku 1**: wygeneruj plik schematu ORM dla bazy relacyjnej oraz zmodyfikuj serwis integracji z Gemini, aby przyjmował sparametryzowany `tenant_id`.
2. Przygotuj strukturę pod zmienne środowiskowe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL`).
3. Zadbaj o to, aby dotychczas działająca logika Google Calendar nie uległa uszkodzeniu – powinna zostać rozszerzona o identyfikator kalendarza per użytkownik.

**Zacznij od wygenerowania schematu bazy danych i przedstawienia struktury katalogów v2.**