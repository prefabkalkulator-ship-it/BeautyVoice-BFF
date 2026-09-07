import { useState } from 'react';
import { 
  BookOpen, Search, ChevronDown, ChevronUp, ArrowRight, Sparkles, 
  PhoneCall, Users, Calendar, HelpCircle, ClipboardList, CreditCard,
  CheckCircle2, AlertCircle, Copy, Check
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
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'onboarding-order': true,
    'faq-training': true,
    'call-forwarding': true
  });
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const categories = [
    { id: 'all', label: 'Wszystkie tematy', icon: BookOpen },
    { id: 'start', label: '1. Pierwsze kroki', icon: Sparkles },
    { id: 'faq', label: '2. Baza Wiedzy (Czat AI)', icon: HelpCircle },
    { id: 'services', label: '3. Usługi i Cennik', icon: ClipboardList },
    { id: 'team', label: '4. Zespół i Grafiki', icon: Users },
    { id: 'timeoff', label: '5. Dni Wolne', icon: Calendar },
    { id: 'forwarding', label: 'Przekierowania GSM', icon: PhoneCall },
    { id: 'subscription', label: 'Abonament i Minuty', icon: CreditCard }
  ];

  const guideItems: GuideItem[] = [
    // 1. PIERWSZE KROKI
    {
      id: 'onboarding-order',
      category: 'start',
      question: 'W jakiej kolejności powinienem skonfigurować konto?',
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
                <span>*21*+48459568507#</span>
                <button
                  onClick={() => copyToClipboard('*21*+48459568507#', 'fwd-21')}
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
                <span>*61*+48459568507**15#</span>
                <button
                  onClick={() => copyToClipboard('*61*+48459568507**15#', 'fwd-61')}
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
              <strong>Jak wyłączyć przekierowanie?</strong> Wystarczy wklepać na telefonie kod <code className="font-mono font-bold">#21#</code> lub <code className="font-mono font-bold">#61#</code> i zatwierdzić zieloną słuchawką. Przekierowanie zostanie natychmiast wyłączone.
            </div>
          </div>
        </div>
      )
    },

    // 2. BAZA WIEDZY
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
          </div>
        </div>
      )
    },

    // 2b. JĘZYKI ASYSTENTA
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

    // 2c. KONTAKT Z CZŁOWIEKIEM
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
              <span><strong>Oddzwonienie 1 kliknięciem:</strong> Możesz od razu kliknąć w powiadomienie i oddzwonić do klienta, mając pełny kontekst jego sprawy. Żadne ważne zapytanie nie przepada!</span>
            </div>
          </div>
        </div>
      )
    },

    // 3. USŁUGI
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

    // 4. ZESPÓŁ I GRAFIKI
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

    // 5. DNI WOLNE
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

    // 6. ABONAMENT I MINUTY
    {
      id: 'minutes-usage',
      category: 'subscription',
      question: 'Jak naliczane są darmowe minuty w abonamencie?',
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
    // 7. REGULAMIN I DPA (PRAWO)
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

  const filteredItems = guideItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Nagłówek */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-100 text-gold-900 text-xs font-semibold mb-3 border border-gold-300">
          <BookOpen className="w-3.5 h-3.5" /> Centrum Wiedzy i Instrukcja
        </div>
        <h1 className="text-3xl font-serif text-surface-900">Instrukcja Użytkownika</h1>
        <p className="text-surface-600 mt-2 text-sm sm:text-base">
          Wszystko, co musisz wiedzieć o konfiguracji, działaniu asystenta EVA oraz obsłudze połączeń w Twojej firmie.
        </p>
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
          placeholder="Wyszukaj instrukcję (np. przekierowanie, cennik, grafiki, minuty, uczenie)..."
          className="block w-full pl-11 pr-4 py-3.5 bg-white border border-surface-200 rounded-2xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 shadow-xs text-sm"
        />
      </div>

      {/* Przyciski kategorii */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map(cat => {
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
