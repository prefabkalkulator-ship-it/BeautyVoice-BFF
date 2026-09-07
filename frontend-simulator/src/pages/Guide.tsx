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
    { id: 'services', label: '2. Usługi i Cennik', icon: ClipboardList },
    { id: 'faq', label: '3. Baza Wiedzy EVA', icon: HelpCircle },
    { id: 'team', label: '4. Zespół i Pracownicy', icon: Users },
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
      summary: 'Optymalna ścieżka: Profil i Godziny → Usługi → Baza Wiedzy → Zespół → Dni Wolne.',
      actionPath: '/dashboard/settings',
      actionLabel: 'Przejdź do Ustawień',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Aby wirtualny asystent EVA mógł bezbłędnie umawiać klientów na wizyty i odpowiadać na pytania, 
            kluczowe jest zachowanie logicznej kolejności konfiguracji:
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <strong>Profil Firmy i Godziny Pracy (Ustawienia Firmy):</strong> Wpisz nazwę, branżę, opis oraz harmonogram otwarcia salonu. Dzięki temu asystent wie, kiedy salon przyjmuje klientów.
            </li>
            <li>
              <strong>Usługi i Cennik (Usługi):</strong> Wprowadź wszystkie zabiegi/usługi wraz z ich ceną i czasem trwania (np. 45 min).
            </li>
            <li>
              <strong>Baza Wiedzy (Baza Wiedzy):</strong> Dodaj odpowiedzi na często zadawane pytania (lokalizacja, parking, płatność kartą, przeciwwskazania).
            </li>
            <li>
              <strong>Zarządzanie Zespołem (Ustawienia Firmy → Zespół):</strong> Dodaj pracowników i <u>przypisz im zdefiniowane w kroku 2 usługi</u>. (Pracownik musi wiedzieć, które zabiegi wykonuje).
            </li>
            <li>
              <strong>Dni Wolne i Święta (Dni Wolne):</strong> Oznacz dni zamknięcia salonu lub urlopy zespołu, aby asystent nie zapisywał w tym czasie klientów.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: 'call-forwarding',
      category: 'forwarding',
      question: 'Jak włączyć przekierowanie rozmów z mojego telefonu firmowego na numer asystenta?',
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
                Każde połączenie przychodzące odbiera natychmiast asystentka EVA (świetne w trakcie pracy z klientem):
              </p>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-surface-200 font-mono font-bold text-sm">
                <span>*21*+48459568507#</span>
                <button
                  onClick={() => copyToClipboard('*21*+48459568507#', 'fwd-21')}
                  className="text-gold-600 hover:text-gold-800 p-1"
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
                Telefon dzwoni u Ciebie, a jeśli nie odbierzesz w 15 sekund, połączenie przejmuje EVA:
              </p>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-surface-200 font-mono font-bold text-sm">
                <span>*61*+48459568507**15#</span>
                <button
                  onClick={() => copyToClipboard('*61*+48459568507**15#', 'fwd-61')}
                  className="text-gold-600 hover:text-gold-800 p-1"
                  title="Kopiuj kod"
                >
                  {copiedCode === 'fwd-61' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <strong>Jak wyłączyć przekierowanie?</strong> Wystarczy wklepać na telefonie kod <code className="font-mono font-bold">#21#</code> lub <code className="font-mono font-bold">#61#</code> i zatwierdzić zieloną słuchawką. Przekierowanie zostanie natychmiast wyłączone.
            </div>
          </div>
        </div>
      )
    },

    // 2. USŁUGI
    {
      id: 'services-duration',
      category: 'services',
      question: 'Dlaczego czas trwania usługi jest tak ważny dla asystenta?',
      summary: 'Asystent EVA rezerwuje precyzyjny blok czasu w kalendarzu, zapobiegając nakładaniu się wizyt.',
      actionPath: '/dashboard/services',
      actionLabel: 'Zarządzaj Usługami',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Podczas rozmowy telefonicznej asystent EVA sprawdza w ułamku sekundy kalendarz salonu. Jeśli klient pyta np. o godzinę 14:00, 
            asystent sprawdza, czy od 14:00 do 14:00 + [czas trwania usługi] pracownik jest wolny.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Dokładność:</strong> Wpisuj rzeczywisty czas wykonania zabiegu (np. 60 min).</li>
            <li><strong>Cena:</strong> Podaj cenę regularną (lub zakres), aby asystent mógł ją podać klientowi pytającemu o cennik.</li>
            <li><strong>Opis:</strong> Krótki opis w usłudze pomoże asystentowi doradzić klientowi, który waha się między dwoma zabiegami.</li>
          </ul>
        </div>
      )
    },

    // 3. BAZA WIEDZY
    {
      id: 'faq-training',
      category: 'faq',
      question: 'Jak najlepiej uczyć asystenta odpowiedzi na pytania?',
      summary: 'Dodawaj zwięzłe pary pytanie-odpowiedź lub wgraj dokument z opisem salonu.',
      actionPath: '/dashboard/faq',
      actionLabel: 'Przejdź do Bazy Wiedzy',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Baza wiedzy to „mózg” Twojego asystenta. Im lepsze odpowiedzi tam umieścisz, tym naturalniej i pewniej asystent rozmawia z klientem.
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Najważniejsze tematy:</strong> Gdzie zaparkować, czy można płacić BLIK-iem/kartą, czy przyjmujecie z dziećmi, jak przygotować się do wizyty.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Naturalny język:</strong> Pisz prostym językiem, np. „Tak, mamy darmowy parking dla klientów z tyłu budynku za szlabanem”.</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span><strong>Bezpieczeństwo:</strong> Jeśli klient zapyta o coś, czego nie ma w bazie, asystent grzecznie poinformuje, że przekaże pytanie właścicielowi i poprosi o kontakt.</span>
            </div>
          </div>
        </div>
      )
    },

    // 4. ZESPÓŁ
    {
      id: 'team-assignment',
      category: 'team',
      question: 'Dlaczego muszę przypisać usługi do konkretnych pracowników?',
      summary: 'Asystent musi wiedzieć, który pracownik wykonuje jakie zabiegi, by nie zapisać klienta do niewłaściwej osoby.',
      actionPath: '/dashboard/settings',
      actionLabel: 'Skonfiguruj Zespół',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            W salonach wieloosobowych (lub gabinetach z kilkoma specjalistami) każdy pracownik ma swoje specjalizacje (np. Stylistka Paznokci, Fryzjer Kolorysta, Kosmetolog).
          </p>
          <p>
            Gdy klient dzwoni i mówi: <em>„Chcę zapisać się na manicure hybrydowy na piątek”</em>, asystent sprawdza grafik 
            <strong>wyłącznie tych pracowników, którzy mają przypisaną usługę „Manicure hybrydowy”</strong>.
          </p>
          <p className="text-xs bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900 font-medium">
            Wskazówka: Z tego powodu najpierw zdefiniuj usługi w zakładce „Usługi”, a dopiero potem przejdź do dodawania pracowników w Ustawieniach!
          </p>
        </div>
      )
    },

    // 5. DNI WOLNE
    {
      id: 'timeoff-rules',
      category: 'timeoff',
      question: 'Jak działają Dni Wolne i blokady w kalendarzu?',
      summary: 'Dodanie dnia wolnego uniemożliwia asystentowi umówienie wizyty w wybranym dniu.',
      actionPath: '/dashboard/timeoff',
      actionLabel: 'Zarządzaj Dniami Wolnymi',
      answer: (
        <div className="space-y-3 text-sm text-surface-700 leading-relaxed">
          <p>
            Zakładka <strong>Dni Wolne</strong> służy do wprowadzania świąt, urlopów pracowniczych, przerw technicznych czy remontów.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Cały salon:</strong> Oznacz dzień jako wolny dla całego salonu – asystent nie zaproponuje klientowi tego dnia żadnego terminu.</li>
            <li><strong>Pojedynczy pracownik:</strong> Możesz wybrać konkretnego pracownika, który ma urlop – wówczas inni pracownicy nadal mogą przyjmować rezerwacje na swoje usługi.</li>
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
            faktycznego trwania rozmowy telefonicznej klienta z asystentem.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Średnia rozmowa umawiająca wizytę trwa ok. <strong>1 - 1.5 minuty</strong>. Oznacza to, że pakiet 300 minut pozwala obsłużyć nawet 200–300 rozmów telefonicznych w miesiącu!</li>
            <li>W zakładce <strong>Subskrypcja</strong> zawsze widzisz bieżący stan zużycia minut w formacie <code className="font-mono font-bold">minuty_użyte / minuty_w_pakiecie</code>.</li>
            <li>Jeśli planujesz przerwę w działalności (np. dłuższy urlop w salonie), w zakładce Subskrypcja możesz jednym kliknięciem <strong>Zawiesić konto na 30 dni</strong> bez utraty żadnych danych.</li>
          </ul>
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
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-100 text-gold-800 text-xs font-semibold mb-3 border border-gold-200">
          <BookOpen className="w-3.5 h-3.5" /> Centrum Wiedzy i Instrukcja
        </div>
        <h1 className="text-3xl font-serif text-surface-900">Instrukcja Użytkownika</h1>
        <p className="text-surface-600 mt-2 text-sm sm:text-base">
          Wszystko, co musisz wiedzieć o konfiguracji, działaniu asystenta EVA oraz obsłudze połączeń.
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
          placeholder="Wyszukaj instrukcję (np. przekierowanie, cennik, pracownicy, minuty)..."
          className="block w-full pl-11 pr-4 py-3.5 bg-white border border-surface-200 rounded-2xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 shadow-sm text-sm"
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
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-white border border-surface-200 text-surface-700 hover:bg-surface-100 hover:text-surface-900'
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
              className="mt-3 text-xs text-gold-600 hover:underline font-semibold"
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
                className="bg-white rounded-3xl border border-surface-200 shadow-xs overflow-hidden transition-all hover:border-surface-300"
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
                          onClick={() => navigate(item.actionPath!)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-surface-800 transition shadow-xs"
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
