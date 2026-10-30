import { getSystemPrompt } from '../prompts/systemPrompt';
import { BookingService } from '../services/BookingService';
import { isLikelyForeignText } from '../services/LanguageSafetyService';

function runTests() {
  console.log('🧪 Rozpoczynam testy weryfikacyjne Protokołu Językowego, Bramki Weryfikacyjnej i Polskiego Języka Notatek...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // 1. Test profilu osobistego (GUEST - rozmówca dzwoniący do Pana Dymitra)
  const personalGuestPrompt = getSystemPrompt({
    businessProfile: 'personal',
    ownerName: 'Dymitr Mitrafanau',
    callerRole: 'GUEST',
    profession: 'Architekt i wykonawca domów modułowych',
    bioSummary: 'Domy modułowe MDM, stan surowy, wentylacja, płyta fundamentowa'
  });

  assert(
    personalGuestPrompt.includes('BEZWZGLĘDNA NADRZĘDNOŚĆ PROTOKOŁU JĘZYKOWEGO'),
    'Test 1.1: Hierarchia ważności - Bramka Językowa jest bezwzględnie nadrzędna nad innymi regułami'
  );

  assert(
    personalGuestPrompt.includes('TARCZA PRZED FAŁSZYWYMI PRZYJACIÓŁMI I ŁACIŃSKO-ROMAŃSKIMI RDZENIAMI') &&
    personalGuestPrompt.includes('placă de fundație') &&
    personalGuestPrompt.includes('ventilație') &&
    personalGuestPrompt.includes('płyta fundamentowa / fundamenty'),
    'Test 1.2: Ochrona przed fałszywymi przyjaciółmi budowlanymi i fonetyczną konfuzją rumuńską'
  );

  assert(
    !personalGuestPrompt.includes('ŚCISŁE WZORCE PYTAŃ WERYFIKACYJNYCH DLA POSZCZEGÓLNYCH JĘZYKÓW') &&
    personalGuestPrompt.includes('KATEGORYCZNY ZAKAZ ZADAWANIA PYTAŃ WERYFIKACYJNYCH I ZAKAZ INICJOWANIA MOWY OBCEJ') &&
    personalGuestPrompt.includes('TARCZA PRZED POWITANIAMI, SŁOWAMI POTOCZNYMI I ZAKŁÓCENIAMI (HALO / HALO HALO / SCHWEIGEN)'),
    'Test 1.3: Usunięto wzorce pytań weryfikacyjnych i dodano zakaz pytań weryfikacyjnych oraz tarczę przed halo/halo halo'
  );

  assert(
    personalGuestPrompt.includes('ŻELAZNA REGUŁA: SKRÓT INTENCJI (INTENT SHORTCUTS)') &&
    personalGuestPrompt.includes('Jest w 100% PODPORZĄDKOWANA PROTOKOŁOWI JĘZYKOWEMU!') &&
    personalGuestPrompt.includes('KATEGORYCZNY ZAKAZ używania języka rumuńskiego lub innych języków obcych!'),
    'Test 1.4: Skrót intencji (Intent Shortcuts) jest podporządkowany regule językowej'
  );

  assert(
    personalGuestPrompt.includes('ZŁOTA ZASADA JĘZYKA INTERFEJSU I BIZNESU') &&
    personalGuestPrompt.includes('WSZYSTKIE PISEMNE NOTATKI, STRESZCZENIA I PODSUMOWANIA (\'callSummary\' w endCall oraz \'rawMessage\' w save_call_message) MUSZĄ BYĆ BEZWZGLĘDNIE I W 100% SPORZĄDZONE W JĘZYKU POLSKIM!'),
    'Test 1.5: Złota zasada języka interfejsu nakazuje 100% polskie notatki i streszczenia nawet dla rozmów obcojęzycznych'
  );

  assert(
    !personalGuestPrompt.includes('Biegłą znajomość ponad 140 języków aktywujesz') &&
    !personalGuestPrompt.includes('(Jeśli zapyta w innym języku, przetłumacz tę odpowiedź na jego język)'),
    'Test 1.6: Usunięto zwroty promujące pochopne przełączanie języka (140 języków / automatyczne tłumaczenie tożsamości)'
  );

  assert(
    personalGuestPrompt.includes('ŚCIEŻKA BEZPOŚREDNIEJ PROŚBY (DIRECT REQUEST) – JEDYNA DROGA PRZEŁĄCZENIA JĘZYKA') &&
    personalGuestPrompt.includes('Do you speak English?') &&
    personalGuestPrompt.includes('Чи можна українською?') &&
    personalGuestPrompt.includes('Sprechen Sie Deutsch?'),
    'Test 1.7: Jedyna ścieżka przełączenia języka to bezpośrednia prośba rozmówcy (Direct Request)'
  );

  assert(
    !personalGuestPrompt.includes('Rozmawiam w języku polskim. W czym mogę pomóc? Jeśli woli Pan/Pani inny język') &&
    personalGuestPrompt.includes('ABSOLUTNY, KATEGORYCZNY ZAKAZ RECYTOWANIA JAKICHKOLWIEK FORMUŁEK TYPU „ROZMAWIAM W JĘZYKU POLSKIM”') &&
    personalGuestPrompt.includes('TARCZA PRZED NAZWAMI HANDLOWYMI, MODELAMI I SERIAMI PRODUKTÓW (MDM, OPTIMAL, ENERGY, SMART, MODERN, ECO)'),
    'Test 1.8: Usunięto sztywny szablon o języku polskim, zakazano formułek o języku i dodano osłonę dla MDM Optimal 58'
  );

  // 2. Test profilu DEMO
  const demoPrompt = getSystemPrompt({
    tenantName: 'DEMO',
    businessProfile: 'demo'
  });

  assert(
    demoPrompt.includes('TARCZA PRZED FAŁSZYWYMI PRZYJACIÓŁMI I ŁACIŃSKO-ROMAŃSKIMI RDZENIAMI'),
    'Test 2.1: Profil DEMO zawiera osłonę przed konfuzją łacińsko-romańską'
  );

  assert(
    !demoPrompt.includes('Biegłą znajomość ponad 140 języków aktywujesz'),
    'Test 2.2: Profil DEMO nie zawiera luźnych zwrotów prowokujących przełączenie'
  );

  // 3. Test definicji narzędzi w BookingService
  const tools = BookingService.getToolDefinitions('hourly', true, 'GUEST', 'personal');
  const saveCallMsgTool = tools.find((t: any) => t.name === 'save_call_message');
  const endCallTool = tools.find((t: any) => t.name === 'endCall');
  const getFaqTool = tools.find((t: any) => t.name === 'getFAQ');

  assert(
    saveCallMsgTool &&
    saveCallMsgTool.description.includes('ZASADA JĘZYKA INTERFEJSU') &&
    saveCallMsgTool.description.includes('Parametry rawMessage i callerName MUSZĄ być ZAWSZE zapisane w 100% w języku polskim dla właściciela'),
    'Test 3.1: save_call_message w definicji narzędzia nakazuje język polski interfejsu nawet przy obcej mowie'
  );

  assert(
    endCallTool &&
    endCallTool.description.includes('ZASADA JĘZYKA INTERFEJSU') &&
    endCallTool.description.includes('Parametr callSummary MUSI być bezwzględnie i w 100% w języku polskim (nawet jeśli cała rozmowa z rozmówcą toczyła się w języku obcym!)'),
    'Test 3.2: endCall w definicji narzędzia nakazuje 100% polskie callSummary'
  );

  assert(
    getFaqTool &&
    getFaqTool.description.includes('Jeśli rozmowa toczy się po polsku, odpowiadaj w 100% po polsku') &&
    getFaqTool.description.includes('Direct Request'),
    'Test 3.3: getFAQ nakazuje odpowiedź po polsku i tłumaczenie w locie wyłącznie po Direct Request'
  );

  // 4. Test modułu wykrywania obcego języka (LanguageSafetyService)
  const romanianSample = "Solicită modificarea ofertei anterioare prin eliminarea plăcii de fundație și a ventilației.";
  assert(
    isLikelyForeignText(romanianSample),
    'Test 4.1: isLikelyForeignText poprawnie wykrywa notatkę w języku rumuńskim'
  );

  const ukrainianSample = "Доброго дня, я хотів би дізнатися про ціну будинку";
  assert(
    isLikelyForeignText(ukrainianSample),
    'Test 4.2: isLikelyForeignText poprawnie wykrywa cyrylicę / język ukraiński'
  );

  const englishSample = "Please call me back regarding the quotation for next week";
  assert(
    isLikelyForeignText(englishSample),
    'Test 4.3: isLikelyForeignText poprawnie wykrywa język angielski'
  );

  const polishSample1 = "[💼 Oferta/Doradztwo] Klient prosi o modyfikację oferty: usunięcie płyty fundamentowej i wentylacji. Pan Dymitr skontaktuje się z klientem. Nastrój i zachowanie: spokojny.";
  assert(
    !isLikelyForeignText(polishSample1),
    'Test 4.4: isLikelyForeignText nie kwalifikuje poprawnego polskiego podsumowania jako obcego'
  );

  const polishSample2 = "[📝 Wiadomość] Jan Kowalski: Proszę o kontakt telefoniczny po południu w sprawie spotkania.";
  assert(
    !isLikelyForeignText(polishSample2),
    'Test 4.5: isLikelyForeignText nie kwalifikuje polskiej wiadomości jako obcej'
  );

  // 5. Test Tury 1 i natychmiastowego podejmowania sprawy (Skrót Intencji w pierwszym kontakcie)
  assert(
    personalGuestPrompt.includes('WYJĄTEK ABSOLUTNY – ROZMÓWCA W TURZE 1 OD RAZU MÓWI O SWOJEJ SPRAWIE (SKRÓT INTENCJI & PYTANIA O OFERTĘ/MODELE)') &&
    personalGuestPrompt.includes('MDM Optimal 58') &&
    personalGuestPrompt.includes('NATYCHMIAST wywołaj narzędzie \'getFAQ\' i odpowiedz konkretnie i merytorycznie po polsku!') &&
    personalGuestPrompt.includes('KATEGORYCZNY ZAKAZ ponownego dopytywania o imię przed udzieleniem odpowiedzi!') &&
    personalGuestPrompt.includes('KATEGORYCZNY ZAKAZ mówienia "z kim mam przyjemność?" lub "nie dosłyszałam, z kim rozmawiam"!'),
    'Test 5.1: Tura 1 zawiera bezwzględny nakaz natychmiastowej obsługi sprawy rozmówcy (w tym pytań o MDM Optimal 58 i getFAQ) bez pytania o imię'
  );

  assert(
    personalGuestPrompt.includes('Dzwonię w sprawie korekty oferty...') &&
    personalGuestPrompt.includes('Chodzi o usunięcie płyty fundamentowej lub wentylacji...'),
    'Test 5.2: Wzorce Skrótu Intencji zawierają jednoznaczne przykłady korekty oferty i wyceny'
  );

  console.log(`\n========================================`);
  console.log(`Wynik testów: ${passed} zdanych, ${failed} nieudanych.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
