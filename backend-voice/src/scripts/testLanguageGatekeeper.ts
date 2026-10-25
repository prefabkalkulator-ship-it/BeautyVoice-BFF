import { getSystemPrompt } from '../prompts/systemPrompt';
import { BookingService } from '../services/BookingService';

function runTests() {
  console.log('🧪 Rozpoczynam testy weryfikacyjne Protokółu Językowego i Bramki Weryfikacyjnej...\n');

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
    personalGuestPrompt.includes('Bună ziua! Ați dori să vorbiți în română?'),
    'Test 1.3: Wzorzec Bramki Weryfikacyjnej dla języka rumuńskiego'
  );

  assert(
    personalGuestPrompt.includes('ŻELAZNA REGUŁA: SKRÓT INTENCJI (INTENT SHORTCUTS)') &&
    personalGuestPrompt.includes('Jest w 100% PODPORZĄDKOWANA PROTOKOŁOWI JĘZYKOWEMU!') &&
    personalGuestPrompt.includes('KATEGORYCZNY ZAKAZ używania języka rumuńskiego lub innych języków obcych!'),
    'Test 1.4: Skrót intencji (Intent Shortcuts) jest podporządkowany bramce językowej'
  );

  assert(
    personalGuestPrompt.includes('rawMessage i callerName w save_call_message oraz callSummary w endCall') &&
    personalGuestPrompt.includes('argumenty \'rawMessage\', \'callerName\' i \'callSummary\' MUSZĄ BYĆ W 100% ZAPISYWANE W JĘZYKU POLSKIM!'),
    'Test 1.5: Parametry narzędzi biznesowych muszą być w 100% po polsku'
  );

  assert(
    !personalGuestPrompt.includes('Biegłą znajomość ponad 140 języków aktywujesz') &&
    !personalGuestPrompt.includes('(Jeśli zapyta w innym języku, przetłumacz tę odpowiedź na jego język)'),
    'Test 1.6: Usunięto zwroty promujące pochopne przełączanie języka (140 języków / automatyczne tłumaczenie tożsamości)'
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
    saveCallMsgTool.description.includes('ZASADA JĘZYKOWA') &&
    saveCallMsgTool.description.includes('Kategoryczny zakaz zapisywania treści w języku rumuńskim czy innym obcym, gdy klient mówi po polsku'),
    'Test 3.1: save_call_message w definicji narzędzia nakazuje język polski i zakazuje rumuńskich halucynacji'
  );

  assert(
    endCallTool &&
    endCallTool.description.includes('Parametr callSummary MUSI być bezwzględnie w języku polskim'),
    'Test 3.2: endCall w definicji narzędzia nakazuje podsumowanie w języku polskim'
  );

  assert(
    getFaqTool &&
    getFaqTool.description.includes('Jeśli rozmowa toczy się po polsku, odpowiadaj w 100% po polsku'),
    'Test 3.3: getFAQ nakazuje odpowiedź po polsku dopóki bramka nie zatwierdzi języka obcego'
  );

  console.log(`\n========================================`);
  console.log(`Wynik testów: ${passed} zdanych, ${failed} nieudanych.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
