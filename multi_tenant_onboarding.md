# Strategia Multi-Tenant: Skalowanie Systemu BeautyVoice dla Wielu Salonów

Wraz ze wzrostem popularności aplikacji, BeautyVoice nie będzie już obsługiwał tylko jednego salonu, ale stanie się platformą typu **SaaS (Software as a Service)**. Poniżej znajduje się architektura oraz proces wdrażania (onboardingu) nowych klientów B2B.

---

## 1. Architektura Wielodostępowa (Multi-Tenancy)
Obecnie nasz system korzysta już z zalążków tej architektury – każdy zasób w bazie (usługi, rezerwacje, FAQ) posiada klucz `tenantId`. 

W docelowej wersji:
- **Separacja danych:** Klienci (salony) współdzielą jedną bazę danych, ale dane są ściśle izolowane. Zapytania do bazy *zawsze* będą wymuszać klauzulę `where: { tenantId }`.
- **Własna Baza Wiedzy (RAG):** Każdy salon będzie miał własną, niezależną zakładkę FAQ i cenników. LLM Gemini, przed rozpoczęciem rozmowy, zaciągnie "wiedzę" wyłącznie z zakresu danego `tenantId`.

---

## 2. Zarządzanie Numerami Telefonów (SIP / Webhooks)
Największym wyzwaniem jest przypisanie wirtualnych numerów telefonicznych do konkretnych salonów.

**Jak to będzie działać:**
1. Nowy salon wykupuje (lub dzierżawi od nas) numer komórkowy/stacjonarny (np. w Zadarmie).
2. W naszej bazie danych pojawia się tabela `TenantSettings`, w której przechowujemy:
   - `assignedPhoneNumber` (np. +48459568507)
   - Klucze API do SMS-ów salonu (aby koszty wysyłki SMS spadały na ich konto pre-paid)
   - Nazwę asystenta (np. "Zosia" zamiast "Eva") i preferowany głos.

**Routing Połączeń i SMS:**
- Kiedy przychodzi połączenie, system (np. z Twilio/Zadarma) wysyła do nas numer docelowy (`To` / `called_did`). 
- Nasz system robi zapytanie: `SELECT tenantId FROM TenantSettings WHERE assignedPhoneNumber = 'numer_docelowy'`.
- Dzięki temu system błyskawicznie wie, do jakiego salonu dzwoni klient, ładuje odpowiedni cennik, kalendarz i bazę wiedzy. 
- Ten sam mechanizm zadziała przy przychodzących SMS-ach (anulowaniach).

---

## 3. Proces Wdrażania Nowego Salonu (Onboarding Flow)

W przyszłości zautomatyzujemy ten proces z poziomu dedykowanego panelu SaaS.

### Krok 1: Rejestracja i subskrypcja
- Właściciel salonu wchodzi na naszą stronę (Frontend) i zakłada konto. 
- Zostaje mu wygenerowany unikalny `tenantId` (np. "salon_12345").

### Krok 2: Konfiguracja Asystenta
- Właściciel wybiera płeć, ton głosu oraz imię asystenta.
- System prosi o podłączenie zewnętrznego numeru telefonu (instrukcja wklejenia naszego Webhooka w panelu ich dostawcy SIP, lub automatyczny zakup numeru przez nasze API partnerskie u operatora).

### Krok 3: Baza Wiedzy i Pracownicy
- W panelu salon dodaje listę swoich usług, czasy trwania i przydziela pracowników.
- Uzupełnia zakładkę "Baza Wiedzy" – wpisuje tam instrukcje parkowania, informacje o formach płatności czy godziny otwarcia.

### Krok 4: Integracja Grafiku
- Docelowo, zamiast wbudowanego kalendarza, zaoferujemy integrację z systemami typu **Booksy**, **Versum** czy **Calendly** przez ich API. 
- Asystent głosowy będzie wtedy działał jako nakładka sztucznej inteligencji na gotowy ekosystem salonu.

---

## 4. Personalizacja zachowań LLM (Prompt Injection)
Aby każdy salon brzmiał unikalnie, nasz główny `systemPrompt.ts` stanie się "szablonem". 

Przed połączeniem serwer dynamicznie wygeneruje instrukcję:
> "Jesteś wirtualną asystentką salonu {Tenant.Name}. Masz na imię {Tenant.BotName}. Twój styl wypowiedzi to: {Tenant.Tone}.
> Twoja baza wiedzy to: {Tenant.FaqData}. 
> Pracują u Ciebie: {Tenant.StaffList}."

Dzięki temu ten sam kod backendu może obsługiwać salon fryzjerski na luzie ("Cześć, w czym pomóc?") oraz klinikę medycyny estetycznej ("Dzień dobry, z kim mam przyjemność?").
