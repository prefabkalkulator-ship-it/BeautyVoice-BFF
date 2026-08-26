# SZKIC: Regulamin Świadczenia Usług (Terms of Service B2B)
**Data ostatniej aktualizacji:** [Data]

Niniejszy dokument stanowi zarys punktów, które należy zawrzeć w ostatecznym regulaminie świadczenia usług B2B (Business-to-Business) dla platformy SaaS BeautyVoice. Skupia się on głównie na zabezpieczeniu Platformy (Dostawcy) z perspektywy prawa telekomunikacyjnego, odpowiedzialności za ruch oraz RODO (Umowa Powierzenia Przetwarzania Danych).

*Uwaga: Ten dokument jest szkicem technicznym, a nie wiążącą poradą prawną. Należy go skonsultować z radcą prawnym przed uruchomieniem komercyjnej wersji serwisu.*

---

## 1. Postanowienia Ogólne i Model Świadczenia Usługi
1. Usługodawca (Dostawca Platformy SaaS) świadczy usługę automatycznego asystenta AI służącego do procesowania rezerwacji wizyt dla Usługobiorcy (Salonu).
2. Usługa jest przeznaczona wyłącznie dla podmiotów gospodarczych (relacja B2B).
3. Usługodawca nie świadczy klasycznych, publicznych usług telekomunikacyjnych w rozumieniu Prawa Telekomunikacyjnego, a jedynie dostarcza oprogramowanie odbierające przekierowany ruch głosowy i przekształcające go w rezerwacje.

## 2. Odpowiedzialność za Ruch Telekomunikacyjny i Numery (Ważne!)
1. **Publiczny Numer Salonu**: Usługobiorca oświadcza, że posiada wyłączne prawa do publicznego numeru telefonu, którym posługuje się w celach marketingowych, i na którym ustawia przekierowania połączeń na numery techniczne Usługodawcy.
2. **Numer Techniczny (Bramka)**: Usługodawca udostępnia Usługobiorcy wewnętrzny numer techniczny służący **wyłącznie do odbierania połączeń przekierowanych** z numeru publicznego Usługobiorcy. Usługobiorca ma zakaz reklamowania numeru technicznego jako swojego własnego oraz zakaz wykorzystywania go do jakichkolwiek działań telemarketingowych (tzw. "cold calling").
3. **Zakaz Wykorzystywania do Celów Niezgodnych z Prawem**: Usługobiorca przyjmuje pełną odpowiedzialność za treść i cel połączeń przychodzących kierowanych do Platformy. Usługodawca zastrzega sobie prawo do natychmiastowego zablokowania konta Usługobiorcy i wypowiedzenia umowy w trybie natychmiastowym, jeżeli stwierdzi, że Platforma jest używana do:
   - Spamowania i phishingu,
   - Przestępstw oszustwa,
   - Odbierania połączeń o charakterze nielegalnym lub naruszającym dobre obyczaje.
4. **Zwolnienie z odpowiedzialności (Indemnity)**: Usługobiorca zgadza się w pełni zwolnić Usługodawcę z wszelkiej odpowiedzialności finansowej, cywilnej i karnej wynikającej z roszczeń osób trzecich w związku z nieodpowiednim zarządzaniem ruchem telefonicznym przez Usługobiorcę.

## 3. Komunikacja Wychodząca SMS
1. W ramach funkcjonowania usługi asystenta, Platforma wysyła automatyczne powiadomienia SMS na numery pacjentów/klientów (np. potwierdzenie wizyty, możliwość anulacji).
2. **Zgody Marketingowe / Techniczne**: Usługobiorca (Salon) oświadcza, że posiada niezbędne, udokumentowane zgody swoich klientów końcowych na kontakt i otrzymywanie powiadomień operacyjnych SMS, zgodnie z wymogami prawnymi (RODO).
3. Usługodawca występuje jedynie w roli podmiotu dostarczającego infrastrukturę do wysyłki tych powiadomień i nie jest odpowiedzialny za brak odpowiednich zgód po stronie Usługobiorcy.

## 4. Ochrona Danych Osobowych (Umowa Powierzenia - DPA)
Akceptacja niniejszego Regulaminu stanowi równocześnie zawarcie Umowy Powierzenia Przetwarzania Danych Osobowych na następujących warunkach:
1. **Rola Stron**: Usługobiorca (Salon) jest Administratorem Danych Osobowych (ADO) swoich pacjentów. Usługodawca (Platforma) jest Podmiotem Przetwarzającym (Procesorem).
2. **Zakres Powierzonych Danych**: Obejmuje: numery telefonów dzwoniących, nagrania głosowe prowadzonych rozmów (transkrypcje), imiona i nazwiska podawane przez dzwoniących, daty i rodzaje rezerwacji.
3. **Cel Przetwarzania**: Świadczenie usługi asystenta głosowego (analiza intencji, generowanie odpowiednich wpisów w wirtualnym kalendarzu i wysyłka SMS z potwierdzeniem).
4. **Podwykonawcy**: Usługobiorca wyraża ogólną zgodę na korzystanie przez Usługodawcę z podmiotów trzecich w celu realizacji usługi (tzw. Dalsi Procesorzy), takich jak:
   - Google LLC (obsługa serwerów Google Cloud i LLM Gemini)
   - Zadarma / Twilio (obsługa infrastruktury głosowej SIP/RTP i SMS)

## 5. Dostępność i Ograniczenia Techniczne (SLA)
1. Usługodawca dokłada wszelkich starań, by usługa działała 24/7 (np. 99% SLA), jednak nie ponosi odpowiedzialności za utracone korzyści w wyniku krótkotrwałych awarii (np. przerw w działaniu infrastruktury VoIP, awarii modelu AI).
2. Połączenia głosowe nie mogą służyć jako infolinie alarmowe ani medyczne wymagające natychmiastowej diagnozy ratującej życie. Asystent pełni jedynie funkcję recepcyjną.

---
*Informacja dla Administratora Projektu: Skopiuj powyższe założenia i skonsultuj je z osobą odpowiedzialną za prawną obsługę projektu, aby przekuć je w pełnoprawny, obowiązujący prawnie dokument przed udostępnieniem formularza rejestracji do panelu.*
