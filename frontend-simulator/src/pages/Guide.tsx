import { useState, useEffect } from 'react';
import { 
  BookOpen, Search, ChevronDown, ChevronUp, ArrowRight, Sparkles, 
  PhoneCall, Users, Calendar, HelpCircle, ClipboardList, CreditCard,
  CheckCircle2, AlertCircle, Copy, Check, Clock, Lock, 
  Share2, Bell, UserCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GuideItem {
  id: string;
  category: string;
  question: string;
  summary: string;
  answer: React.ReactNode;
  actionPath?: string;
  actionLabel?: string;
}

export default function Guide() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [guideMode, setGuideMode] = useState<'personal' | 'business'>('business');
  const [assignedPhone, setAssignedPhone] = useState<string>('+48459568507');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'personal-onboarding': true,
    'personal-forwarding': true,
    'personal-schedule-zones': true,
    'onboarding-order': true,
    'call-forwarding': true
  });
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
    fetch('/api/tenant')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.businessProfile === 'personal') {
            setGuideMode('personal');
          } else {
            setGuideMode('business');
          }
          if (data.assignedPhoneNumber) {
            setAssignedPhone(data.assignedPhoneNumber);
          }
        }
      })
      .catch(err => console.error('Failed to load tenant in Guide:', err));
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setOpenItems(prev => ({ ...prev, [hash]: true }));
        setTimeout(() => {
          const el = document.getElementById(hash);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 250);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- KATEGORIE DLA ASYSTENTA OSOBISTEGO ---
  const personalCategories = [
    { id: 'all', label: 'Wszystkie tematy', icon: BookOpen },
    { id: 'start', label: '1. Pierwsze kroki & BIO', icon: Sparkles },
    { id: 'forwarding', label: '2. Przekierowania GSM', icon: PhoneCall },
    { id: 'schedule', label: '3. Strefy & Terminy', icon: Clock },
    { id: 'contacts', label: '4. Kontakty & Noc', icon: UserCheck },
    { id: 'owner', label: '5. Tryb Właściciela & PIN', icon: Lock },
    { id: 'dates', label: '6. Ważne Daty & Baza', icon: Calendar },
    { id: 'reports', label: '7. Briefing & Notatki', icon: Share2 },
    { id: 'subscription', label: '8. Pakiet Osobisty (149 zł)', icon: CreditCard }
  ];

  // --- KATEGORIE DLA ASYSTENTA FIRMOWEGO ---
  const businessCategories = [
    { id: 'all', label: 'Wszystkie tematy', icon: BookOpen },
    { id: 'start', label: '1. Pierwsze kroki', icon: Sparkles },
    { id: 'faq', label: '2. Baza Wiedzy (Czat AI)', icon: HelpCircle },
    { id: 'services', label: '3. Usługi i Cennik', icon: ClipboardList },
    { id: 'team', label: '4. Zespół i Grafiki', icon: Users },
    { id: 'timeoff', label: '5. Dni Wolne', icon: Calendar },
    { id: 'forwarding', label: 'Przekierowania GSM', icon: PhoneCall },
    { id: 'subscription', label: 'Abonament i Minuty', icon: CreditCard }
  ];

  // --- INSTRUKCJE DLA ASYSTENTA OSOBISTEGO ---
  const personalGuideItems: GuideItem[] = [
    {
      id: 'personal-onboarding',
      category: 'start',
      question: 'Jak w 5 prostych krokach przygotować Asystenta Osobistego?',
      summary: 'Szybka ścieżka wdrożenia: Profil i BIO → Przekierowanie GSM → Kontakty z priorytetem → Ważne daty w roku → Test połączenia.',
      actionPath: '/dashboard/settings',
      actionLabel: 'Otwórz Ustawienia Asystenta',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Twój osobisty asystent AI działa jak prywatny sekretarz w Twojej kieszeni. Aby optymalnie chronił Twój czas i organizował dzień:
          </p>
          <ol className="list-decimal pl-5 space-y-2.5">
            <li>
              <strong>Profil & BIO (Ustawienia):</strong> Podaj swoje imię, zawód (np. Inwestor, Architekt, Prawnik, Freelancer) oraz krótkie BIO określające styl pracy.
            </li>
            <li>
              <strong>Przekierowanie GSM:</strong> Włącz w telefonie przekierowanie na dedykowany numer asystenta <code className="font-mono font-bold text-surface-900">{assignedPhone}</code> (zawsze lub gdy nie odbierasz po 15 sek).
            </li>
            <li>
              <strong>Kontakty z Dostępem Priorytetowym (Kontakty VIP):</strong> Dodaj numery bliskich (Rodzina, Przyjaciele) oraz partnerów biznesowych i zaznacz ptaszek <em>„Udostępnij Terminy Priorytetowe”</em>.
            </li>
            <li>
              <strong>Wprowadź Ważne Daty w roku:</strong> W zakładce <em>Ważne Daty</em> podaj urodziny bliskich, rocznice i kluczowe terminy lub jednym kliknięciem wygeneruj oficjalne Święta Państwowe.
            </li>
            <li>
              <strong>Wykonaj test połączenia:</strong> Zadzwoń do asystenta, by sprawdzić jak się wita, poproś o zapisanie zadania lub zapytaj o plan dnia.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: 'personal-adaptive-roles',
      category: 'start',
      question: 'Jak działa Behawioralny Kameleon i automatyczne przełączanie ról asystenta?',
      summary: 'Asystent dynamicznie adaptuje swój styl do intencji rozmówcy – od dyskretnego sekretarza, przez aktywnego doradcę handlowego, po deeskalację trudnych spraw i pełną dyskrecję Twojego nazwiska.',
      actionPath: '/dashboard/settings',
      actionLabel: 'Profil Asystenta',
      answer: (
        <div className="space-y-4 text-sm text-surface-700 leading-relaxed">
          <p>
            W Pakiecie Osobistym asystent nie posługuje się jednym sztywnym skryptem. Działa jak inteligentny, behawioralny kameleon, analizując ton i intencje dzwoniącego w czasie rzeczywistym:
          </p>
          <div className="space-y-2.5">
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-xs">
              <strong className="text-surface-900 block mb-1">🤫 Dyskrecja Nazwiska (Privacy Shield):</strong>
              W powitaniach inicjalnych asystent posługuje się wyłącznie Twoim imieniem w wołaczu (np. <em>„asystent pana Jana”</em> lub <em>„asystentka pani Joanny”</em>). Twoje nazwisko jest chronione i ujawniane wyłącznie wtedy, gdy rozmówca wyraźnie i z własnej inicjatywy o nie zapyta.
            </div>
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-950">
              <strong className="text-blue-900 block mb-1">👔 Rola Bazowa: Dyskretny Sekretarz (Domyślna):</strong>
              Wyciszony, elegancki filtr połączeń. Asystent selekcjonuje rozmówców, notuje wiadomości i chroni Twój czas bez narzucania się (automatyczny tryb proaktywny: WYŁĄCZONY).
            </div>
            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs text-emerald-950">
              <strong className="text-emerald-900 block mb-1">💼 Rola 2: Doradca / Handlowiec (Automatyczna Proaktywność):</strong>
              Uruchamiana natychmiast, gdy dzwoniący pyta o ofertę, zakres usług, współpracę lub cennik. Asystent bada potrzeby techniką pytań otwartych Chrisa Vossa, prezentuje kluczowe atuty z Bazy Wiedzy i aktywnie proponuje spotkanie techniką wyboru alternatywnego (np. <em>„Czy wolałby Pan wtorek rano czy czwartek popołudniu?”</em>) spośród wolnych slotów w kalendarzu.
            </div>
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-950">
              <strong className="text-amber-900 block mb-1">🛡️ Rola 3: Deeskalacja i Wsparcie (Reklamacje):</strong>
              Gdy rozmówca jest poddenerwowany, składa skargę lub zgłasza pilny problem, asystent natychmiast wyłącza jakąkolwiek proaktywność sprzedażową. Stosuje empatię taktyczną (Tactical Empathy), wycisza emocje, zapewnia o natychmiastowym przekazaniu sprawy właścicielowi i zapisuje priorytetowe zgłoszenie.
            </div>
            <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 text-xs text-purple-950">
              <strong className="text-purple-900 block mb-1">📅 Rola 4: Organizacja Terminu:</strong>
              Nastawiona na precyzyjną weryfikację wolnych slotów z rygorystycznym poszanowaniem Czasu Skupienia i godzin pracy.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'personal-forwarding',
      category: 'forwarding',
      question: 'Jak włączyć przekierowanie ze smartfona na numer asystenta osobistego?',
      summary: 'Użyj bezpłatnych kodów GSM w aplikacji telefonu na smartfonie. Asystent odbierze każde połączenie, którego nie zdążysz odebrać samemu.',
      actionPath: '/dashboard/subscription',
      actionLabel: 'Twój numer asystenta',
      answer: (
        <div className="space-y-4 text-sm text-surface-700 leading-relaxed">
          <p>
            Nie musisz wymieniać karty SIM! Wpisz w dialerze (aplikacji telefonu) jeden z poniższych kodów MMI i zatwierdź zieloną słuchawką:
          </p>
          
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
              <div className="font-bold text-surface-900 text-xs uppercase text-gold-700 mb-1">
                Wariant A: Przy braku odbioru (po 15 sek.) – Zalecane
              </div>
              <p className="text-xs text-surface-600 mb-2">
                Telefon dzwoni u Ciebie. Jeśli nie odbierzesz w ciągu 15 sekund (np. prowadzisz auto lub jesteś na spotkaniu), rozmowę płynnie przejmuje asystent:
              </p>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-surface-200 font-mono font-bold text-sm">
                <span>*61*{assignedPhone}**15#</span>
                <button
                  onClick={() => copyToClipboard(`*61*${assignedPhone}**15#`, 'p-fwd-61')}
                  className="text-gold-700 hover:text-gold-950 p-1"
                  title="Kopiuj kod"
                >
                  {copiedCode === 'p-fwd-61' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
              <div className="font-bold text-surface-900 text-xs uppercase text-gold-700 mb-1">
                Wariant B: Pełna ochrona czasu (100% połączeń)
              </div>
              <p className="text-xs text-surface-600 mb-2">
                Każde połączenie przychodzące odbiera natychmiast asystent osobisty (doskonałe podczas głębokiej pracy, urlopu lub snu):
              </p>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-surface-200 font-mono font-bold text-sm">
                <span>*21*{assignedPhone}#</span>
                <button
                  onClick={() => copyToClipboard(`*21*${assignedPhone}#`, 'p-fwd-21')}
                  className="text-gold-700 hover:text-gold-950 p-1"
                  title="Kopiuj kod"
                >
                  {copiedCode === 'p-fwd-21' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-xs">
              <strong>Gdy zajęty / odrzucasz:</strong> <code className="font-mono font-bold text-surface-800">*67*{assignedPhone}#</code>
            </div>
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-xs">
              <strong>Gdy poza zasięgiem / wyłączony:</strong> <code className="font-mono font-bold text-surface-800">*62*{assignedPhone}#</code>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-blue-700 mt-0.5" />
            <div>
              <strong>Jak natychmiast wyłączyć przekierowanie?</strong> Wpisz w telefonie kod uniwersalny <code className="font-mono font-bold">##002#</code> i zatwierdź słuchawką. Wyłącza to wszystkie aktywne przekierowania operatora.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'personal-schedule-zones',
      category: 'schedule',
      question: 'Jak działają Strefy Dostępności (Praca, Prywatna, Cisza Nocna)?',
      summary: 'Asystent inteligentnie dopasowuje godziny spotkań zależnie od tego, kim jest dzwoniący i o jakiej porze dzwoni.',
      actionPath: '/dashboard/settings',
      actionLabel: 'Dostosuj Strefy Dostępności',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            W Pakiecie Osobistym Twój kalendarz nie jest jedną sztywną listą. System dzieli Twój tydzień na 3 inteligentne strefy:
          </p>
          <div className="space-y-2.5">
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-950">
              <strong className="text-blue-900 block mb-1">🏢 Strefa Pracy (Domyślnie Pn–Pt, np. 09:00–17:00):</strong>
              W tym przedziale asystent przyjmuje telefony służbowe, umawia spotkania robocze i konsultacje z klientami oraz nowymi numerami.
            </div>
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-xs text-amber-950">
              <strong className="text-amber-900 block mb-1">🏡 Strefa Prywatna (Domyślnie Pn–Sb, np. 17:00–21:00):</strong>
              Dostępna wyłącznie dla relacji <em>Prywatne</em> oraz <em>Rodzina</em>. Obce i służbowe numery dzwoniące po godzinach pracy zostają uprzejmie poinformowane o zakończeniu dnia roboczego, a asystent proponuje zapisanie wiadomości.
            </div>
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-xs text-purple-950">
              <strong className="text-purple-900 block mb-1">🌙 Cisza Nocna & Filtr Nagłych Spraw (22:00–07:00):</strong>
              Asystent chroni Twój sen i nie łączy żadnych rutynowych rozmów. Wyjątkiem jest kategoria <em>Rodzina</em> – jeśli bliski zgłosi nagłą sprawę awaryjną, asystent wyzwoli natychmiastowy priorytetowy alert Push na Twój telefon.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'personal-focus-blocks',
      category: 'schedule',
      question: 'Jak działa „Czas Skupienia & Lekcji” (blokady na lekcje, zabiegi i Deep Work)?',
      summary: 'Zablokuj stałe godziny na prowadzenie zajęć, lekcji, zabiegów lub nieprzerwaną pracę. Asystent nigdy nie zaoferuje w tym czasie żadnych terminów ani nie połączy rozmowy.',
      actionPath: '/dashboard/settings',
      actionLabel: 'Ustaw Czas Skupienia',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Jeśli pracujesz jako lektor, nauczyciel, lekarz, prawnik lub prowadzisz sesje wymagające 100% obecności:
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Bezwzględna blokada slotów:</strong> W godzinach oznaczonych jako Czas Skupienia asystent traktuje Twój kalendarz jako całkowicie niedostępny – żaden rozmówca z zewnątrz ani kontakt priorytetowy nie otrzyma wtedy terminu na spotkanie ani telefon.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Twarda ochrona backendowa (zero kolizji):</strong> Każda próba zapisu w kalendarzu jest weryfikowana na poziomie milisekund bezpośrednio w bazie danych. Asystent ma systemowy zakaz proponowania godzin "z głowy" – proponuje wyłącznie terminy potwierdzone jako wolne, z pełnym poszanowaniem Czasu Skupienia i godzin pracy.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Kulturalna odpowiedź asystenta:</strong> Jeśli ktoś zadzwoni w trakcie Twojej lekcji, asystent poinformuje, że prowadzisz teraz zajęcia lub pracujesz w skupieniu, i zaproponuje zapisanie wiadomości bądź umówienie kontaktu w wolnym oknie.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Wiele bloków tygodniowo:</strong> Możesz zdefiniować dowolną liczbę bloków (np. osobno poranne lekcje w Pn/Śr i popołudniowe warsztaty w Czwartki).</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'personal-priority-access',
      category: 'schedule',
      question: 'Czym jest „Dostęp Priorytetowy” i jak działają Złote Okienka?',
      summary: 'Terminy priorytetowe to specjalne sloty w Twoim kalendarzu, które asystent proponuje wyłącznie wybranym osobom z zaznaczonym uprawnieniem.',
      actionPath: '/dashboard/vip-contacts',
      actionLabel: 'Zarządzaj Kontaktami z Priorytetem',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Tradycyjny podział na „VIP” bywa mylący – pierwszeństwo do Twojego czasu może mieć kluczowy wspólnik, inwestor, ale też lekarz, współmałżonek czy dziecko.
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
              <span><strong>Ptaszek „Udostępnij Terminy Priorytetowe”:</strong> W zakładce Kontakty VIP zaznacz to pole przy dowolnej osobie, niezależnie od jej kategorii relacji.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
              <span><strong>Złote Okienka w Ustawieniach:</strong> Możesz zdefiniować np. poranne godziny 08:00–10:00 lub wybrane dni wyłącznie na terminy priorytetowe.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
              <span><strong>Inteligentna propozycja AI:</strong> Gdy dzwoni osoba z priorytetem, asystent od razu proponuje te zarezerwowane, najlepsze okienka, których nie widzą zwykli dzwoniący.</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'personal-contact-levels',
      category: 'schedule',
      question: 'Jakie są 3 poziomy kontaktu (Spotkanie, Telefon, Zadanie)?',
      summary: 'Nie każda sprawa wymaga rezerwacji godziny w kalendarzu. Asystent potrafi elastycznie rozróżniać formy kontaktu.',
      actionPath: '/dashboard/calendar',
      actionLabel: 'Otwórz Wydarzenia i Kalendarz',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Rozmawiając z dzwoniącym, asystent dopasowuje odpowiednią formę do charakteru sprawy:
          </p>
          <div className="grid sm:grid-cols-3 gap-2.5 pt-1">
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200">
              <div className="font-bold text-xs text-surface-900 flex items-center gap-1.5 mb-1">
                <span>🤝 Spotkanie</span>
              </div>
              <p className="text-xs text-surface-600">
                Wymaga obecności osobistej lub wideokonferencji. Standardowy czas trwania to 30–60 minut.
              </p>
            </div>
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200">
              <div className="font-bold text-xs text-surface-900 flex items-center gap-1.5 mb-1">
                <span>📞 Telefon</span>
              </div>
              <p className="text-xs text-surface-600">
                Krótkie połączenie telefoniczne w dogodnej chwili. Zajmuje zwięzły slot 10–15 minut.
              </p>
            </div>
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200">
              <div className="font-bold text-xs text-surface-900 flex items-center gap-1.5 mb-1">
                <span>📌 Zadanie / Akcja</span>
              </div>
              <p className="text-xs text-surface-600">
                Nie blokuje kalendarza. Asystent zapisuje notatkę i wysyła Ci powiadomienie Push z podsumowaniem sprawy.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'personal-call-transfer',
      category: 'contacts',
      question: 'Jak działa funkcja „Przełączanie aktywnego połączenia” (Live Call Transfer)?',
      summary: 'Dzwoniący VIP lub Rodzina z pilną sprawą mogą zostać natychmiast przełączeni na Twoją komórkę. Jeśli nie odbierzesz w 30 sek., asystent przejmuje rozmowę z powrotem.',
      actionPath: '/dashboard/vip-contacts',
      actionLabel: 'Zarządzaj Kontaktami VIP',
      answer: (
        <div className="space-y-4 text-sm text-surface-700 leading-relaxed">
          <p>
            Funkcja <strong>Live Call Transfer</strong> umożliwia bezpośrednie przełączenie rozmowy telefonicznej z wirtualnego asystenta na Twój prywatny smartfon w trakcie trwania połączenia:
          </p>

          <div className="space-y-2.5">
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-950">
              <strong className="text-amber-900 block mb-1">👑 Wyłącznie dla kategorii VIP oraz Rodzina:</strong>
              Zwykli dzwoniący, klienci z zewnątrz czy telemarketerzy <u>nigdy nie są przełączani bezpośrednio</u> – asystent chroni Twój spokój (Privacy Shield). Narzędzie transferu uruchamia się tylko wtedy, gdy dzwoni bliska osoba z bazy VIP/Rodzina z pilną, niecierpiącą zwłoki sprawą i kategorycznie prosi o połączenie z Tobą.
            </div>

            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-950">
              <strong className="text-blue-900 block mb-1">⏱️ Limit oczekiwania (30 sekund):</strong>
              Asystent mówi rozmówcy: <em>„Łączę bezpośrednio z właścicielem. Proszę czekać na linii.”</em> i natychmiast wybiera Twój numer komórkowy. Twój telefon zaczyna dzwonić.
            </div>

            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs text-emerald-950">
              <strong className="text-emerald-900 block mb-1">🔄 Inteligentny Fallback (gdy nie odbierzesz lub odrzucisz):</strong>
              Jeśli w ciągu 30 sekund nie odbierzesz telefonu lub odrzucisz połączenie (np. prowadzisz spotkanie), Twój rozmówca <strong>nie zostaje rozłączony</strong>. Połączenie natychmiast wraca do asystenta na tej samej linii, który mówi dosłownie:
              <blockquote className="mt-1.5 p-2 bg-white/90 rounded border-l-2 border-emerald-500 font-medium italic text-surface-800">
                „Właściciel nie mógł teraz odebrać. Zostaw wiadomość, a przekażę ją natychmiast.”
              </blockquote>
              Asystent wysłuchuje rozmówcę, zapisuje jego słowa i natychmiast wysyła Ci powiadomienie Push z notatką, nie ponawiając już transferu w tej samej rozmowie.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'personal-vip-night-rules',
      category: 'contacts',
      question: 'Kto może dzwonić w nocy i jak działa Ochrona Ciszy Nocnej?',
      summary: 'W godzinach nocnych (22:00–07:00) asystent grzecznie odrzuca rutynowe połączenia. Tylko kategoria Rodzina w stanie wyższej konieczności wyzwala natychmiastowy alert.',
      actionPath: '/dashboard/settings',
      actionLabel: 'Konfiguracja Ciszy Nocnej',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Ochrona Ciszy Nocnej (22:00 – 07:00) czuwa nad Twoim odpoczynkiem i snem:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong>Klienci biznesowi i obcy:</strong> Asystent informuje, że godziny pracy kancelarii/biura dobiegły końca i zaprasza do kontaktu rano.
            </li>
            <li>
              <strong>Kategoria Rodzina:</strong> Asystent weryfikuje czy sprawa jest nagła (awaria, zdrowie). W sytuacji krytycznej natychmiast wysyła głośny alert Push oznaczony priorytetem CRITICAL na Twój telefon.
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'personal-owner-mode',
      category: 'owner',
      question: 'Jak działa Tryb Właściciela, autoryzacja kodem PIN i Raport na Żądanie?',
      summary: 'Gdy dzwonisz ze swojego numeru komórkowego, asystent wymaga podania kodu PIN (domyślnie 7777). Po autoryzacji odblokowuje dostęp do Twojego kalendarza, wiadomości oraz raportu e-mail.',
      actionPath: '/dashboard/settings',
      actionLabel: 'Ustawienia PIN Właściciela',
      answer: (
        <div className="space-y-4 text-sm text-surface-700 leading-relaxed">
          <p>
            Gdy dzwonisz na dedykowany numer asystenta ze swojego smartfona zarejestrowanego w profilu:
          </p>
          <div className="space-y-2.5">
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-xs">
              <strong className="text-surface-900 block mb-1">🔐 Komunikat Bezpieczeństwa & Żądanie PIN:</strong>
              Jeśli w <em>Ustawieniach Asystenta</em> masz włączoną opcję „Wymagaj PIN przy połączeniu z mojego numeru komórkowego”, asystent wita Cię słowami:
              <blockquote className="mt-1 p-2 bg-white rounded border-l-2 border-gold-500 font-medium italic text-surface-800">
                „Dzień dobry Janie! Ze względów bezpieczeństwa, proszę podaj swój kod PIN, aby uzyskać dostęp do panelu asystenta.”
              </blockquote>
            </div>
            <div className="p-3 bg-red-50/70 rounded-xl border border-red-200 text-xs text-red-950">
              <strong className="text-red-900 block mb-1">🛡️ Żelazna Kurtyna Danych & Limit 3 Prób:</strong>
              Dopóki nie podasz poprawnego PIN-u (domyślnie <code className="font-mono font-bold">7777</code> lub Twój własny), asystent ma bezwzględny zakaz ujawniania jakichkolwiek informacji o spotkaniach, wiadomościach czy sprawach pilnych. Po 3 błędnych próbach następuje blokada i degradacja do roli zwykłego gościa (GUEST).
            </div>
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-950">
              <strong className="text-blue-900 block mb-1">📊 Raport Dnia na Żądanie (Głosowo i E-mail):</strong>
              Po autoryzacji powiedz: <em>„Podaj podsumowanie dnia”</em> – asystent przeczyta zwięzłą syntezę spraw pilnych i spotkań. Możesz też powiedzieć: <em>„Wyślij podsumowanie na mój e-mail”</em> – natychmiast otrzymasz wielosekcyjny raport HTML ze wszystkimi zarejestrowanymi połączeniami, klikalnymi numerami telefonów i kalendarzem, a na telefon przyjdzie potwierdzenie Push!
            </div>
            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs text-emerald-950">
              <strong className="text-emerald-900 block mb-1">🎙️ Szybkie Dyktowanie Zadań:</strong>
              Możesz powiedzieć: <em>„Zapisz zadanie: odebrać dokumenty z sądu w czwartek o 15:00”</em> lub <em>„Zablokuj mi piątek od 12:00 do 14:00”</em> – asystent natychmiast zaktualizuje Twój kalendarz.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'personal-confidential-knowledge',
      category: 'owner',
      question: 'Czym jest Baza Wiedzy Poufnej i jak zabezpieczyć odpowiedzi kodem PIN?',
      summary: 'W Bazie Wiedzy możesz oznaczyć wybrane wpisy jako „Poufne”. Asystent ujawni je dzwoniącemu wyłącznie po podaniu dedykowanego kodu PIN (domyślnie 7777).',
      actionPath: '/dashboard/faq',
      actionLabel: 'Przejdź do Bazy Wiedzy',
      answer: (
        <div className="space-y-4 text-sm text-surface-700 leading-relaxed">
          <p>
            Funkcja Bazy Wiedzy Poufnej pozwala przechowywać w asystencie wrażliwe informacje (np. kody do domofonu/bramy, poufne procedury, numery polis, indywidualne stawki dla zaufanych partnerów), chroniąc je przed przypadkowymi osobami:
          </p>
          <div className="space-y-2.5">
            <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 text-xs text-purple-950">
              <strong className="text-purple-900 block mb-1">🔒 Oznaczanie wpisów w Bazie Wiedzy (Q&A):</strong>
              Podczas dodawania lub edycji pytania w zakładce <em>Baza Wiedzy</em> wystarczy zaznaczyć pole wyboru: <strong>„Oznacz jako wiedzę poufną (wymaga podania PIN przez dzwoniącego)”</strong>. Taki kafelek zyskuje fioletową odznakę <span className="font-semibold text-purple-700">🔒 Poufne (wymaga PIN)</span>.
            </div>
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-950">
              <strong className="text-amber-900 block mb-1">🔑 Niezależny PIN (Domyślnie 7777):</strong>
              PIN do wiedzy poufnej jest <strong>całkowicie niezależny od PIN-u Właściciela</strong>. Możesz go w każdej chwili zmienić w <em>Ustawieniach Asystenta</em> w sekcji <em>„Baza Wiedzy Poufnej (PIN dostępu)”</em>.
            </div>
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-xs text-surface-800">
              <strong className="text-surface-900 block mb-1">🛡️ Architektura Zero Data Leakage (Brak wycieków w AI):</strong>
              Treści poufne nie są ładowane do ogólnego prompta rozmowy. Model zna wyłącznie same nazwy tematów poufnych. Gdy rozmówca zapyta o poufną kwestię, asystent kulturalnie odpowiada:
              <blockquote className="mt-1 p-2 bg-white rounded border-l-2 border-purple-500 font-medium italic text-surface-800">
                „Informacja na ten temat jest poufna. Proszę podać kod PIN, aby uzyskać do niej dostęp.”
              </blockquote>
              Dopiero po poprawnym wypowiedzeniu PIN-u asystent bezpiecznie pobiera odpowiedź z bazy danych i odblokowuje wiedzę poufną na czas trwania tej rozmowy.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'personal-important-dates',
      category: 'dates',
      question: 'Jak wprowadzać Ważne Daty w roku (urodziny bliskich, kluczowe terminy)?',
      summary: 'Wprowadź daty w dedykowanej zakładce Ważne Daty lub wygeneruj Święta Państwowe. Zobaczysz je w kalendarzu i porannym raporcie Push.',
      actionPath: '/dashboard/annual-events',
      actionLabel: 'Przejdź do Ważnych Dat',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Nie musisz pamiętać o rocznicach, urodzinach czy terminach rozliczeniowych. W zakładce <strong>Ważne Daty</strong> możesz:
          </p>
          <div className="bg-surface-50 p-3 rounded-2xl border border-surface-200 text-xs font-mono text-surface-800 space-y-1">
            <p>• Urodziny żony Anny: 15 maja (przypomnienie na 2 dni przed)</p>
            <p>• Kluczowy termin rozliczenia kwartalnego: 25. dzień miesiąca po kwartale</p>
            <p>• Rocznica ślubu: 10 września</p>
            <p>• Oficjalne polskie Święta Państwowe (dodawane 1 kliknięciem)</p>
          </div>
          <div className="space-y-2 pt-1 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
              <span><strong>Baner Całodzienny w Grafiku Dobowym:</strong> Ważne daty przypadające na dany dzień są natychmiast widoczne na samej górze kalendarza z dedykowaną paletą kolorów (🎂 Urodziny, 🏖️ Urlop, 🇵🇱 Święto, 💰 Podatki, 💍 Rocznica).</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
              <span><strong>Widok Miesięczny i Lista Dat:</strong> W widoku miesiąca dni świąt oznaczone są kolorowymi plakietkami emoji, a pod kalendarzem wyświetla się kompletna lista wszystkich ważnych dat w danym miesiącu z możliwością przejścia do wybranego dnia 1 kliknięciem.</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'personal-faq-knowledge',
      category: 'dates',
      question: 'Jak Baza Wiedzy (FAQ) zamienia asystenta w Twojego merytorycznego doradcę?',
      summary: 'Wgraj dokumenty, zasady współpracy, cenniki konsultacji lub podyktuj wiedzę głosem. Asystent odpowie na pytania klientów zgodnie z Twoją wiedzą merytoryczną.',
      actionPath: '/dashboard/faq',
      actionLabel: 'Otwórz Bazę Wiedzy',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Jako profesjonalista (prawnik, lekarz, architekt, konsultant) często otrzymujesz powtarzalne pytania o dokumenty, procedury czy sposób rozliczeń:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Zakładka 'Ucz mnie':</strong> Wklej tekst, wgraj plik PDF/Word lub nagraj notatkę głosową – sztuczna inteligencja automatycznie wygeneruje zestaw pytań i odpowiedzi.</li>
            <li><strong>Wiedza podczas rozmowy na żywo:</strong> Gdy dzwoniący zapyta np. <em>„Jakie dokumenty przygotować na pierwszą konsultację?”</em> lub <em>„Czy wystawia Pan fakturę VAT?”</em>, asystent sięgnie do Bazy Wiedzy i udzieli precyzyjnej odpowiedzi bez angażowania Ciebie.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'personal-reports-share',
      category: 'reports',
      question: 'Jak działają powiadomienia Push, Poranny Raport i bogate podsumowania połączeń?',
      summary: 'Brak spamu e-mail. Podsumowania rozmów z analizą emocji i pytań pobocznych, poranny briefing Push bez duplikatów i natychmiastowe przyciski oddzwonienia.',
      actionPath: '/dashboard/call-history',
      actionLabel: 'Zobacz Wiadomości i Historię',
      answer: (
        <div className="space-y-4 text-sm text-surface-700 leading-relaxed">
          <p>
            Wiadomości, podsumowania i raporty trafiają bezpośrednio do aplikacji PWA na Twoim smartfonie oraz jako natywne powiadomienia Push:
          </p>
          <div className="space-y-2.5">
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-950">
              <strong className="text-amber-900 block mb-1">🌅 Poranny Raport (Push bez duplikatów):</strong>
              Codziennie o wybranej w Ustawieniach godzinie (np. 08:00) otrzymasz zwięzłe powiadomienie Push z liczbą zaplanowanych spotkań, ważnymi datami i rocznicami oraz oczekującymi wiadomościami.
            </div>
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-950">
              <strong className="text-blue-900 block mb-1">🧠 Wielowątkowe Podsumowania AI:</strong>
              Każda zarejestrowana rozmowa w zakładce <em>Wiadomości & Rejestr Połączeń</em> zawiera pełną analizę:
              <ul className="list-disc pl-4 mt-1.5 space-y-1">
                <li><strong>Tag Intencji:</strong> <code className="font-mono font-bold text-xs">[💼 Oferta]</code>, <code className="font-mono font-bold text-xs">[🚨 Zgłoszenie/Reklamacja]</code>, <code className="font-mono font-bold text-xs">[📅 Rezerwacja]</code>, <code className="font-mono font-bold text-xs">[📝 Wiadomość]</code>.</li>
                <li><strong>Główne Ustalenia:</strong> sedno sprawy, data wizyty lub podjęte kroki.</li>
                <li><strong>Pytania Poboczne:</strong> dodatkowe kwestie, o które dopytywał rozmówca.</li>
                <li><strong>Ocena Emocji i Temperamentu:</strong> obiektywny stan rozmówcy (np. <em>spokojny i rzeczowy / mocno poddenerwowany / używał wulgaryzmów</em>).</li>
                <li><strong>Dalsze Kroki:</strong> co należy wykonać lub czego klient oczekuje.</li>
              </ul>
            </div>
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-xs">
              <strong className="text-surface-900 block mb-1">📱 Ergonomiczne Przyciski Szybkiej Akcji:</strong>
              Na smartfonie główny przycisk <strong>„Oddzwoń”</strong> znajduje się na samej górze karty na pełną szerokość ekranu dla wygody kciuka. Pod nim znajdziesz przyciski <strong>„Kopiuj”</strong>, <strong>„Udostępnij”</strong> (WhatsApp, SMS, Slack, Notatki) oraz <strong>„Załatwione”</strong>.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'personal-subscription-rules',
      category: 'subscription',
      question: 'Ile kosztuje Pakiet Osobisty i jak naliczane są minuty?',
      summary: '149 zł / miesiąc z pulą 100 darmowych minut. Dodatkowe minuty w stawce 0,60 zł/min. Pełna przejrzystość bez ukrytych opłat.',
      actionPath: '/dashboard/subscription',
      actionLabel: 'Sprawdź Subskrypcję',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Pakiet Osobisty został stworzony z myślą o osobach ceniących czas, prywatność i elegancję obsługi:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Abonament:</strong> <strong>149 zł / miesiąc</strong>.</li>
            <li><strong>Darmowe minuty w pakiecie:</strong> <strong>100 minut</strong> w każdym okresie rozliczeniowym (zużywane tylko podczas faktycznej rozmowy telefonicznej).</li>
            <li><strong>Minuty ponad pakiet:</strong> Tylko <strong>0,60 zł / min</strong> naliczane sekundowo.</li>
            <li><strong>Brak długich umów:</strong> Możesz w każdej chwili zawiesić konto na 30 dni (np. na czas wakacji) lub anulować subskrypcję z poziomu panelu.</li>
          </ul>
        </div>
      )
    }
  ];

  // --- INSTRUKCJE DLA FIRM (STANDARD / PREMIUM) ---
  const businessGuideItems: GuideItem[] = [
    {
      id: 'onboarding-order',
      category: 'start',
      question: 'W jakiej kolejności powinienem skonfigurować konto firmowe?',
      summary: 'Optymalna ścieżka: Profil → Baza Wiedzy (AI wykryje usługi) → Usługi → Zespół i Grafiki → Dni Wolne.',
      actionPath: '/dashboard/settings',
      actionLabel: 'Przejdź do Ustawień',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Aby wirtualny asystent EVA mógł bezbłędnie umawiać klientów na terminy i odpowiadać na pytania, 
            najwygodniejsza kolejność konfiguracji wygląda następująco:
          </p>
          <ol className="list-decimal pl-5 space-y-2.5">
            <li>
              <strong>Profil Firmy (Ustawienia Firmy):</strong> Wpisz nazwę działalności, branżę, opis oraz dane kontaktowe (email, telefon).
            </li>
            <li>
              <strong>Baza Wiedzy EVA (Baza Wiedzy → Ucz mnie):</strong> Wklej zasady firmy, wgraj dokument lub podyktuj głosem cennik. <u>Czat AI sam przetworzy materiały na Pytania & Odpowiedzi oraz automatycznie wykryje i doda usługi z cenami!</u>
            </li>
            <li>
              <strong>Usługi i Cennik (Usługi):</strong> Przejrzyj wykryte przez AI usługi, uzupełnij brakujące pozycje i upewnij się, że czasy trwania są odpowiednie.
            </li>
            <li>
              <strong>Zarządzanie Zespołem i Grafiki Pracy (Ustawienia Firmy → Zespół):</strong> Dodaj pracowników, ustal ich indywidualne grafiki pracy (godziny w wybrane dni) oraz przypisz im świadczone usługi. <em>Godziny otwarcia Twojej firmy wynikają z grafików pracowników – firma działa od rozpoczęcia pracy najwcześniejszego pracownika do zakończenia najpóźniejszego.</em>
            </li>
            <li>
              <strong>Dni Wolne i Święta (Dni Wolne):</strong> Oznacz dni zamknięcia firmy lub urlopy personelu, aby asystent nie proponował klientom terminów w tym czasie.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: 'call-forwarding',
      category: 'forwarding',
      question: 'Jak włączyć przekierowanie rozmów z telefonu firmowego na numer asystenta?',
      summary: 'Użyj standardowych bezpłatnych kodów GSM operatora (*21* lub *61*).',
      actionPath: '/dashboard/subscription',
      actionLabel: 'Sprawdź Twój numer asystenta',
      answer: (
        <div className="space-y-4 text-sm text-surface-700 leading-relaxed">
          <p>
            Nie musisz wymieniać karty SIM ani kupować nowego telefonu! Przekierowanie włączasz bezpośrednio 
            w aplikacji telefonu na swoim smartfonie firmowym, wpisując krótki kod MMI i zatwierdzając zieloną słuchawką.
          </p>
          
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
              <div className="font-bold text-surface-900 text-xs uppercase text-gold-700 mb-1">
                Wariant A: Zawsze Asystent (100% połączeń)
              </div>
              <p className="text-xs text-surface-600 mb-2">
                Każde połączenie przychodzące odbiera natychmiast asystentka EVA (świetne, gdy pracujesz lub jesteś zajęty):
              </p>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-surface-200 font-mono font-bold text-sm">
                <span>*21*{assignedPhone}#</span>
                <button
                  onClick={() => copyToClipboard(`*21*${assignedPhone}#`, 'fwd-21')}
                  className="text-gold-700 hover:text-gold-950 p-1"
                  title="Kopiuj kod"
                >
                  {copiedCode === 'fwd-21' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
              <div className="font-bold text-surface-900 text-xs uppercase text-gold-700 mb-1">
                Wariant B: Przy braku odbioru (po 15 sek.)
              </div>
              <p className="text-xs text-surface-600 mb-2">
                Telefon dzwoni u Ciebie, a jeśli nie odbierzesz w ciągu 15 sekund, rozmowę automatycznie przejmuje EVA:
              </p>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-surface-200 font-mono font-bold text-sm">
                <span>*61*{assignedPhone}**15#</span>
                <button
                  onClick={() => copyToClipboard(`*61*${assignedPhone}**15#`, 'fwd-61')}
                  className="text-gold-700 hover:text-gold-950 p-1"
                  title="Kopiuj kod"
                >
                  {copiedCode === 'fwd-61' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-blue-700 mt-0.5" />
            <div>
              <strong>Jak wyłączyć przekierowanie?</strong> Wystarczy wklepać na telefonie kod <code className="font-mono font-bold">#21#</code> lub <code className="font-mono font-bold">#61#</code> (albo wyczyścić wszystko kodem <code className="font-mono font-bold">##002#</code>) i zatwierdzić zieloną słuchawką.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'faq-training',
      category: 'faq',
      question: 'Jak najlepiej uczyć asystenta w Bazie Wiedzy?',
      summary: 'Użyj uniwersalnego czatu AI (tekst, pliki, zdjęcia ulotki lub nagranie głosu). AI samo utworzy FAQ oraz wykryje usługi z cennika.',
      actionPath: '/dashboard/faq',
      actionLabel: 'Przejdź do Bazy Wiedzy',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            W zakładce <strong>Baza Wiedzy → Ucz mnie</strong> masz do dyspozycji uniwersalny czat ze sztuczną inteligencją. 
            Nie musisz ręcznie przepisywać dokumentów ani mozolnie dodawać każdej usługi pojedynczo!
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Wygodne wprowadzanie:</strong> Możesz napisać wiadomość, załączyć dokument PDF/Word, zrobić zdjęcie ulotki/cennika lub kliknąć mikrofon i podyktować zasady firmy głosem.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Automatyczne wykrywanie usług:</strong> Sztuczna inteligencja przeanalizuje tekst i samodzielnie uzupełni cennik usług w zakładce Usługi wraz z cenami i czasami trwania.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Generowanie pytań i odpowiedzi:</strong> System utworzy zwięzłe reguły FAQ (dojazd, parking, formy płatności, polityka odwołań, zalecenia).</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Bezpieczeństwo rozmowy:</strong> W zakładce „Baza Wyuczona” możesz w każdej chwili przejrzeć wyuczone odpowiedzi. Jeśli klient zapyta o coś, czego asystent nie ma w bazie, grzecznie poinformuje, że przekaże sprawę właścicielowi firmy.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Wiedza Poufna z kodem PIN:</strong> W widoku edycji kafelka Q&A możesz zaznaczyć opcję „Poufne”. Taka informacja jest ukryta przed ogólnym dostępem i asystent odczyta ją wyłącznie po podaniu przez rozmówcę dedykowanego kodu PIN (domyślnie 7777, do zmiany w Ustawieniach).</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'faq-languages',
      category: 'faq',
      question: 'W jakich językach potrafi rozmawiać asystent EVA?',
      summary: 'Domyślnym językiem jest polski, ale asystent natychmiast płynnie przełącza się na język klienta (np. angielski, ukraiński, rosyjski, niemiecki).',
      actionPath: '/dashboard/faq',
      actionLabel: 'Baza Wiedzy',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Asystent głosowy EVA został zaprojektowany z myślą o firmach obsługujących zarówno klientów lokalnych, jak i zagranicznych:
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Domyślny język polski:</strong> Każde połączenie rozpoczyna się w języku polskim, zgodnie z lokalizacją i profilem Twojej firmy.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Wielojęzyczność w locie (Multilingual AI):</strong> Jeśli klient zada pytanie po angielsku, ukraińsku, rosyjsku, niemiecku lub w innym języku, EVA natychmiast przełącza się na język rozmówcy i kontynuuje całą rozmowę bez opóźnień.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Pełna obsługa rezerwacji:</strong> Cudzoziemiec otrzyma odpowiedź na pytania o ofertę, dojazd czy cennik, a asystent bez problemu zarezerwuje termin w kalendarzu.</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'faq-human-contact',
      category: 'faq',
      question: 'Czy klient może poprosić o kontakt z człowiekiem?',
      summary: 'Tak. Asystent informuje klienta, że przekaże sprawę do recepcji, a w tej samej chwili wysyła powiadomienie Push na telefon personelu z numerem dzwoniącego i powodem rozmowy.',
      actionPath: '/dashboard/settings',
      actionLabel: 'Ustawienia Powiadomień',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Oczywiście! Jeśli dzwoniący klient poprosi o rozmowę z żywym człowiekiem (właścicielem, recepcjonistą) lub sprawa wymaga indywidualnej decyzji:
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Uprzejma reakcja asystenta:</strong> EVA odpowiada naturalnym głosem: <em>„Dobrze, przekazuję prośbę do recepcji, wkrótce ktoś z personelu skontaktuje się z Tobą telefonicznie. Do usłyszenia!”</em>.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Błyskawiczny Push na telefon (FCM):</strong> System w tej samej chwili wysyła powiadomienie push na telefony personelu lub właściciela zarejestrowane w aplikacji, zawierające numer telefonu dzwoniącego oraz powód kontaktu.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Wielowątkowe podsumowanie z oceną emocji:</strong> W historii połączeń i powiadomieniu Push asystent precyzuje intencję ([🚨 Reklamacja], [💼 Oferta]), podaje pytania poboczne i obiektywną ocenę temperamentu rozmówcy.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Oddzwonienie 1 kliknięciem:</strong> Możesz od razu kliknąć w powiadomienie i oddzwonić do klienta, mając pełny kontekst jego sprawy. Żadne ważne zapytanie nie przepada!</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'services-duration',
      category: 'services',
      question: 'Dlaczego czas trwania usługi jest kluczowy dla asystenta?',
      summary: 'Asystent EVA rezerwuje precyzyjny blok czasu w kalendarzu wybranego pracownika, zapobiegając nakładaniu się terminów.',
      actionPath: '/dashboard/services',
      actionLabel: 'Zarządzaj Usługami',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Podczas rozmowy telefonicznej asystent sprawdza dostępność pracowników w ułamku sekundy. Jeśli klient pyta o wolny termin, 
            EVA sprawdza, czy dany pracownik ma wolne okienko trwające dokładnie tyle, ile wynosi zdefiniowany czas trwania usługi.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Dokładny czas trwania:</strong> Wpisuj rzeczywisty czas realizacji (np. 30 min, 1 godzina, 2 godziny).</li>
            <li><strong>Cena:</strong> Podaj cenę regularną lub minimalną – asystent poda ją klientowi dopytującemu o koszty.</li>
            <li><strong>Uniwersalność:</strong> Usługi działają dla każdej branży – może to być zabieg kosmetyczny, wymiana opon, konsultacja weterynaryjna, wynajem sprzętu czy naprawa.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'team-assignment',
      category: 'team',
      question: 'Jak działają grafiki pracy pracowników i przypisywanie usług?',
      summary: 'Godziny działania Twojej firmy wynikają bezpośrednio z grafików pracowników. Każdy pracownik ma własne godziny i przypisane usługi.',
      actionPath: '/dashboard/settings',
      actionLabel: 'Skonfiguruj Zespół',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            W aplikacji nie ma jednego sztywnego harmonogramu otwarcia całej firmy. 
            <strong>Terminy rezerwacji wynikają z indywidualnych grafików pracy poszczególnych pracowników lub stanowisk</strong>, 
            konfigurowanych w oknie „Dodaj / Edytuj pracownika”.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Elastyczne grafiki:</strong> Pracownik A może pracować w poniedziałki 8:00–16:00, a Pracownik B 12:00–20:00. Asystent wie, że w poniedziałek firma obsługuje klientów łącznie od 8:00 do 20:00.
            </li>
            <li>
              <strong>Przypisanie usług:</strong> Pracownikowi zaznaczasz tylko te usługi, które wykonuje. Asystent nigdy nie umówi klienta na daną usługę do pracownika, który jej nie świadczy.
            </li>
            <li>
              <strong>Tryb Solo:</strong> Jeśli prowadzisz działalność samodzielnie, wybierz profil „Solo” – asystent będzie zarządzał Twoim pojedynczym kalendarzem.
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'timeoff-rules',
      category: 'timeoff',
      question: 'Jak zablokować możliwość rezerwacji w święta i podczas urlopów?',
      summary: 'Wprowadź dzień wolny dla całej firmy lub dla konkretnego pracownika.',
      actionPath: '/dashboard/timeoff',
      actionLabel: 'Zarządzaj Dniami Wolnymi',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Zakładka <strong>Dni Wolne</strong> służy do wyznaczania dni, w których asystent nie może zaproponować klientowi terminu.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Święta państwowe:</strong> Przycisk „Święta” pozwala 1 kliknięciem dodać wszystkie oficjalne dni ustawowo wolne od pracy w Polsce.</li>
            <li><strong>Urlop pracownika:</strong> Możesz przypisać dzień wolny do konkretnej osoby – pozostali pracownicy będą wtedy normalnie dostępni do rezerwacji.</li>
            <li><strong>Dni zamknięcia firmy:</strong> Jeśli firma jest nieczynna w określony dzień, pozostaw pole pracownika puste – cały kalendarz zostanie zablokowany.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'minutes-usage',
      category: 'subscription',
      question: 'Jak naliczane są darmowe minuty w abonamencie firmowym?',
      summary: 'Pakiet Standard to 100 min/mc, a pakiet Premium to 300 min/mc rozmów z asystentem.',
      actionPath: '/dashboard/subscription',
      actionLabel: 'Moja Subskrypcja',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Minuty w pakiecie darmowym (100 minut w Standard, 300 minut w Premium) są zużywane tylko podczas 
            faktycznego trwania połączenia telefonicznego klienta z asystentem.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Średnia rozmowa umawiająca termin trwa ok. <strong>1 - 1.5 minuty</strong>. Pakiet 300 minut pozwala obsłużyć 200–300 połączeń miesięcznie bez dodatkowych opłat.</li>
            <li>W zakładce <strong>Subskrypcja</strong> zawsze widzisz bieżący stan zużycia minut w formacie <code className="font-mono font-bold">minuty_użyte / minuty_w_pakiecie</code>.</li>
            <li>W dowolnym momencie możesz <strong>Zawiesić konto na 30 dni</strong> (np. podczas przestoju lub dłuższego urlopu) bez utraty zgromadzonych danych.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'terms-and-dpa',
      category: 'subscription',
      question: 'Gdzie znajdę Regulamin Świadczenia Usług B2B i Umowę Powierzenia Danych (DPA)?',
      summary: 'Zasady świadczenia usług B2B, odpowiedzialność za ruch telefoniczny, zgody SMS oraz warunki RODO.',
      actionPath: 'https://veritas-app.com/eva/regulamin',
      actionLabel: 'Otwórz Regulamin B2B',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Platforma EVA działa w relacji <strong>Business-to-Business (B2B)</strong>. Korzystając z asystenta głosowego oraz numeru technicznego, 
            Twoja firma zachowuje pełną kontrolę i zgodność z przepisami prawa telekomunikacyjnego oraz RODO.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Relacja powierzenia (DPA):</strong> Twoja firma jest Administratorem Danych Osobowych (ADO) swoich klientów, a nasza platforma jest Podmiotem Przetwarzającym (Procesorem).</li>
            <li><strong>Bezpieczeństwo numeru technicznego:</strong> Numer techniczny służy wyłącznie do odbioru przekierowanych połączeń – nie może być wykorzystywany do telemarketingu (cold calling) ani spamu.</li>
            <li><strong>Powiadomienia SMS:</strong> Wiadomości z potwierdzeniem rezerwacji są wysyłane transakcyjnie w imieniu Twojej firmy.</li>
          </ul>
          <div className="pt-2">
            <a 
              href="https://veritas-app.com/eva/regulamin" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-1.5 font-semibold text-gold-600 hover:text-gold-700 underline text-xs"
            >
              <span>Przeczytaj pełny Regulamin Świadczenia Usług B2B</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )
    }
  ];

  const currentCategories = guideMode === 'personal' ? personalCategories : businessCategories;
  const currentGuideItems = guideMode === 'personal' ? personalGuideItems : businessGuideItems;

  const filteredItems = currentGuideItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Nagłówek */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-100 text-gold-900 text-xs font-semibold mb-2 border border-gold-300">
            <BookOpen className="w-3.5 h-3.5" /> Centrum Wiedzy i Instrukcja
          </div>
          <h1 className="text-3xl font-serif text-surface-900">
            {guideMode === 'personal' ? 'Przewodnik: Asystent Osobisty' : 'Instrukcja: Asystent dla Firm'}
          </h1>
          <p className="text-surface-600 mt-1 text-sm sm:text-base">
            {guideMode === 'personal'
              ? 'Wszystko o konfiguracji, strefach dostępności, kontaktach priorytetowych i ochronie Twojego czasu.'
              : 'Wszystko o konfiguracji, działaniu asystenta EVA oraz obsłudze rezerwacji i połączeń w firmie.'}
          </p>
        </div>

        {/* Przełącznik trybu przewodnika */}
        <div className="inline-flex p-1 bg-surface-100 rounded-2xl border border-surface-200 shrink-0">
          <button
            onClick={() => { setGuideMode('personal'); setSelectedCategory('all'); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              guideMode === 'personal'
                ? 'bg-white text-surface-900 shadow-xs border border-surface-200'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-gold-600" />
            <span>Asystent Osobisty</span>
          </button>
          <button
            onClick={() => { setGuideMode('business'); setSelectedCategory('all'); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              guideMode === 'business'
                ? 'bg-white text-surface-900 shadow-xs border border-surface-200'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-surface-600" />
            <span>Dla Firm i Usług</span>
          </button>
        </div>
      </div>

      {/* Wyszukiwarka */}
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            guideMode === 'personal'
              ? 'Wyszukaj w przewodniku osobistym (np. przekierowanie, strefy, PIN, briefing, priorytet)...'
              : 'Wyszukaj instrukcję (np. przekierowanie, cennik, grafiki, minuty, uczenie)...'
          }
          className="block w-full pl-11 pr-4 py-3.5 bg-white border border-surface-200 rounded-2xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 shadow-xs text-sm"
        />
      </div>

      {/* Przyciski kategorii */}
      <div className="flex flex-wrap gap-2 mb-8">
        {currentCategories.map(cat => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-surface-900 text-white shadow-xs'
                  : 'bg-white border border-surface-200 text-surface-700 hover:bg-surface-900 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Lista kafelków akordeonów */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-surface-200">
            <BookOpen className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-600 font-medium text-sm">Nie znaleziono instrukcji pasujących do zapytania.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              className="mt-3 text-xs text-gold-700 hover:underline font-semibold"
            >
              Wyczyść filtry
            </button>
          </div>
        ) : (
          filteredItems.map(item => {
            const isOpen = Boolean(openItems[item.id]);
            return (
              <div
                key={item.id}
                id={item.id}
                className="bg-white rounded-3xl border border-surface-200 shadow-2xs overflow-hidden transition-all hover:border-surface-300"
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  className="w-full text-left p-6 flex items-start justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-serif font-bold text-surface-900 leading-snug">
                      {item.question}
                    </h3>
                    <p className="text-xs sm:text-sm text-surface-500 mt-1">
                      {item.summary}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-surface-100 text-surface-600 shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-2 border-t border-surface-100 bg-surface-50/50">
                    {item.answer}

                    {item.actionPath && (
                      <div className="mt-5 pt-4 border-t border-surface-200/60 flex justify-end">
                        <button
                          onClick={() => {
                            if (item.actionPath?.startsWith('http')) {
                              window.open(item.actionPath, '_blank', 'noopener,noreferrer');
                            } else {
                              navigate(item.actionPath!);
                            }
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-surface-900 text-white hover:bg-surface-800 hover:text-white rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer"
                        >
                          {item.actionLabel || 'Przejdź do konfiguracji'} <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

