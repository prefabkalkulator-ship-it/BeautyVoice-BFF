import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { 
  Bot, 
  Calendar, 
  Clock, 
  Star, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Phone, 
  UserCheck, 
  Check, 
  Sparkles, 
  Crown,
  Download,
  X,
  Share,
  PlusSquare,
  Smartphone,
  CheckCircle2
} from 'lucide-react';

export default function LandingPage() {
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showAndroidManualGuide, setShowAndroidManualGuide] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Sprawdzenie czy aplikacja już działa w trybie zainstalowanym (standalone PWA)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // 2. Wykrycie platformy mobilnej
    const userAgent = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(userAgent);
    const isMobile = ios || android || (window.innerWidth <= 768 && 'ontouchstart' in window);
    setIsIos(ios);
    setIsAndroid(android);

    // 3. Przechwycenie natywnego zdarzenia instalacji na Androidzie (Chromium)
    const installHandler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', installHandler);

    // 4. Jeśli użytkownik jest na telefonie i nie ma zainstalowanej PWA – otwórz modal od razu
    if (isMobile && !standalone) {
      const dismissed = sessionStorage.getItem('eva_install_prompt_dismissed');
      if (!dismissed) {
        const timer = setTimeout(() => {
          setShowInstallModal(true);
        }, 400);
        return () => {
          clearTimeout(timer);
          window.removeEventListener('beforeinstallprompt', installHandler);
        };
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', installHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      // Dla iOS otwieramy wizualną instrukcję krok po kroku
      setShowIosGuide(true);
    } else if (deferredPrompt) {
      // Dla Android wywołujemy natywne okno instalacji
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setShowInstallModal(false);
          sessionStorage.setItem('eva_install_prompt_dismissed', 'true');
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('Błąd wywołania promptu instalacji:', err);
        setShowAndroidManualGuide(true);
      }
    } else {
      // Jeśli przeglądarka Android nie podała beforeinstallprompt, pokazujemy instrukcję
      setShowAndroidManualGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowInstallModal(false);
    setShowIosGuide(false);
    setShowAndroidManualGuide(false);
    sessionStorage.setItem('eva_install_prompt_dismissed', 'true');
  };

  return (
    <div className="min-h-screen bg-surface-50 selection:bg-gold-200 selection:text-gold-900 font-sans flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-surface-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img src="/EVA_favicon_192.png" alt="EVA Logo" className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl shadow-sm" />
            <span className="font-serif text-xl sm:text-2xl text-surface-900 flex items-baseline">
              E<span className="text-[0.65em]">asy</span>V<span className="text-[0.65em]">oice</span>A<span className="text-[0.65em]">ssistant</span>
            </span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <a href="#cennik" className="text-sm font-semibold text-surface-600 hover:text-surface-900 transition-colors hidden sm:inline-block">Cennik</a>
            <Link to="/login" className="text-sm font-semibold text-surface-600 hover:text-surface-900 transition-colors">Zaloguj się</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 pt-24 sm:pt-32 pb-16 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold-50 border border-gold-100 text-gold-700 text-xs sm:text-sm font-medium">
              <Star className="w-4 h-4 text-gold-500" />
              <span>Twoja firma i gabinet otwarte 24/7</span>
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif text-surface-900 tracking-tight leading-[1.15]">
              Twój wirtualny pracownik <span className="text-gold-500 italic block mt-1 sm:mt-2">odbiera telefony za Ciebie</span>
            </h1>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-surface-600 leading-relaxed max-w-2xl mx-auto">
              Zatrudnij EVA – wirtualną asystentkę, która umawia wizyty, odpowiada na pytania i zarządza Twoim kalendarzem oraz sprawami osobistymi 24/7.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 pt-4 sm:pt-6">
              <a href="tel:+48343433088" className="bg-white text-surface-900 border-2 border-surface-200 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-base sm:text-lg font-semibold hover:border-gold-500 hover:text-gold-600 transition-all shadow-sm flex items-center gap-3 w-full sm:w-auto justify-center">
                <Phone className="w-5 h-5 text-gold-500 shrink-0" />
                Przetestuj asystenta
              </a>
              <Link to="/register" className="bg-primary text-primary-foreground px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-base sm:text-lg font-semibold hover:bg-surface-800 hover:text-white transition-all shadow-lg hover:shadow-xl flex items-center gap-2 w-full sm:w-auto justify-center">
                Rozpocznij korzystanie
                <ArrowRight className="w-5 h-5 shrink-0" />
              </Link>
            </div>
          </div>

          {/* Features Grid - 4 Kafelki */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-16 sm:mt-28">
            {[
              {
                icon: <Clock className="w-6 h-6" />,
                title: 'Dostępność 24/7',
                desc: 'Nigdy więcej nieodebranych połączeń. EVA pracuje poza standardowymi godzinami pracy i w weekendy.'
              },
              {
                icon: <Calendar className="w-6 h-6" />,
                title: 'Synchronizacja Kalendarza',
                desc: 'Integracja z kalendarzem na żywo. Wirtualna asystentka widzi wolne terminy i dopisuje do nich nowych klientów.'
              },
              {
                icon: <ShieldCheck className="w-6 h-6" />,
                title: 'Baza wiedzy firmy',
                desc: 'Zna cennik, usługi i zasady. Odpowie na każde standardowe pytanie klienta bez Twojego udziału.'
              },
              {
                icon: <UserCheck className="w-6 h-6" />,
                title: 'Osobisty Asystent AI',
                desc: 'Prywatna sekretarka executive: dyskretne powitanie dwuetapowe, priorytet VIP, autoryzacja PIN i poranny raport push.'
              }
            ].map((feat, i) => (
              <div key={i} className="glass-card p-5 sm:p-7 rounded-3xl relative overflow-hidden group hover:-translate-y-1 transition-transform border border-surface-200 bg-white/80 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-gold-50 text-gold-600 flex items-center justify-center mb-5">
                  {feat.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-serif font-semibold text-surface-900 mb-2">{feat.title}</h3>
                <p className="text-surface-600 text-sm sm:text-base leading-relaxed">{feat.desc}</p>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-gold-100/40 to-transparent rounded-bl-full -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            ))}
          </div>

          {/* Pricing Section */}
          <section id="cennik" className="mt-20 sm:mt-32 pt-6 sm:pt-8">
            <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-3 px-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold-50 border border-gold-200 text-gold-800 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-gold-600" /> Cennik & Pakiety
              </div>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-serif text-surface-900 tracking-tight">
                Wybierz idealny plan dla siebie lub firmy
              </h2>
              <p className="text-surface-600 text-sm sm:text-base lg:text-lg">
                Przejrzyste warunki bez długich umów. Możesz zmienić lub zawiesić pakiet w dowolnym momencie.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
              {/* 1. Pakiet Osobisty */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-surface-200 hover:border-indigo-300 shadow-sm transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-800 text-xs font-bold rounded-lg uppercase tracking-wider">
                      Osobisty Asystent AI
                    </span>
                    <span className="text-xs font-semibold text-surface-500">Executive / Solo</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-serif font-bold text-surface-900 mb-1">Pakiet Osobisty</h3>
                  <div className="mb-4">
                    <div className="text-3xl sm:text-4xl font-bold text-surface-900">149 zł<span className="text-xs sm:text-sm font-normal text-surface-500"> / mc netto</span></div>
                    <p className="text-xs sm:text-sm text-indigo-700 font-semibold mt-1">100 minut w cenie (0,60 zł / min po wyczerpaniu)</p>
                  </div>
                  <p className="text-xs sm:text-sm text-surface-600 mb-6 leading-relaxed">
                    Dla profesjonalistów, menedżerów i wolnych zawodów. Prywatna sekretarka executive: dyskretne odbieranie połączeń, kontakty VIP, kalendarz spraw prywatnych i ochrona prywatności.
                  </p>
                  <ul className="text-xs sm:text-sm space-y-2.5 sm:space-y-3 text-surface-700 border-t border-surface-100 pt-6">
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span>1 dedykowany techniczny numer telefonu komórkowego</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span>Dwuetapowe inteligentne powitanie (ochrona tożsamości)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span>Rozpoznawanie kontaktów VIP (Rodzina, Wspólnik, Klient)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span>Autoryzacja kodem PIN z telefonu właściciela (sprawy poufne)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span>Baza wiedzy ogólnej oraz poufnej (chronionej PIN-em)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span>Raporty dnia: poranny push oraz podsumowanie głosowe i e-mail</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span>Czas skupienia (Deep Work) z automatycznym filtrowaniem połączeń</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span>Rejestr ważnych dat (urodziny, rocznice, polisy)</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-surface-100">
                  <Link
                    to="/register"
                    className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm sm:text-base font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition"
                  >
                    Wybierz Pakiet Osobisty <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* 2. Pakiet Standard B2B */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-surface-200 hover:border-surface-300 shadow-sm transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 bg-surface-100 text-surface-800 text-xs font-bold rounded-lg uppercase tracking-wider">
                      Standard B2B
                    </span>
                    <span className="text-xs font-semibold text-surface-500">Podstawowa Recepcja</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-serif font-bold text-surface-900 mb-1">Pakiet Standard B2B</h3>
                  <div className="mb-4">
                    <div className="text-3xl sm:text-4xl font-bold text-surface-900">199 zł<span className="text-xs sm:text-sm font-normal text-surface-500"> / mc netto</span></div>
                    <p className="text-xs sm:text-sm text-surface-600 font-semibold mt-1">100 darmowych minut na rozmowy z klientami co miesiąc</p>
                  </div>
                  <p className="text-xs sm:text-sm text-surface-600 mb-6 leading-relaxed">
                    Dla jednoosobowych gabinetów i salonów beauty potrzebujących automatycznej recepcji.
                  </p>
                  <ul className="text-xs sm:text-sm space-y-2.5 sm:space-y-3 text-surface-700 border-t border-surface-100 pt-6">
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>100 darmowych minut na rozmowy z klientami co miesiąc</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>1 dedykowany techniczny numer telefonu</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>4 naturalne głosy AI do wyboru (2 żeńskie i 2 męskie)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>Obsługa ponad 140 języków (automatyczna detekcja)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>Baza Wiedzy AI ze zdjęć cenników i plików PDF</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>Grafiki pracowników i obsługa świąt / dni wolnych</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>Automatyczne umawianie terminów w kalendarzu</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>Potwierdzenia SMS do klientów po rezerwacji</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>Samodzielna konfiguracja w 10 minut</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-surface-100">
                  <Link
                    to="/register"
                    className="w-full py-3.5 px-4 bg-surface-900 hover:bg-surface-800 text-white rounded-xl text-sm sm:text-base font-bold shadow-md flex items-center justify-center gap-2 transition"
                  >
                    Wybierz Standard B2B <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* 3. Pakiet Premium B2B */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-amber-400 shadow-xl relative flex flex-col justify-between ring-2 ring-amber-400/20">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] sm:text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1 whitespace-nowrap">
                  <Crown className="w-3.5 h-3.5" /> Rekomendowany – Pełna Automatyzacja
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4 mt-2">
                    <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber-600" /> Premium B2B
                    </span>
                    <span className="text-xs font-semibold text-amber-700">Maksymalizacja Przychodów</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-serif font-bold text-surface-900 mb-1">Pakiet Premium B2B</h3>
                  <div className="mb-4">
                    <div className="text-3xl sm:text-4xl font-bold text-surface-900">399 zł<span className="text-xs sm:text-sm font-normal text-surface-500"> / mc netto</span></div>
                    <p className="text-xs sm:text-sm text-amber-700 font-semibold mt-1">300 darmowych minut na rozmowy w pakiecie co miesiąc</p>
                  </div>
                  <p className="text-xs sm:text-sm text-surface-600 mb-6 leading-relaxed">
                    Dla rozwijających się zespołów, klinik i salonów z aktywnym modułem Marketing AI. Aktywnie zapełnia kalendarz, bada opinie i eliminuje problem „no-show”.
                  </p>
                  <ul className="text-xs sm:text-sm space-y-2.5 sm:space-y-3 text-surface-700 border-t border-surface-100 pt-6">
                    <li className="flex items-start gap-2.5 font-semibold text-amber-950">
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>Wszystko z pakietu Standard B2B, oraz dodatkowo:</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>300 darmowych minut na rozmowy w pakiecie co miesiąc</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>Wypełnianie okienek (Last Minute) – ratowanie odwołanych terminów</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>Badanie satysfakcji (NPS) – automatyczne zbieranie opinii po wizycie</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>Reaktywacja bazy 90+ dni – powrót dawnych klientów do firmy</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>Telefoniczne potwierdzanie wizyt dzień wcześniej (zero „no-show”)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>Wielokanałowość – do 5 jednoczesnych rozmów naraz bez sygnału zajętości</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-surface-100">
                  <Link
                    to="/register"
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-sm sm:text-base font-bold shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition"
                  >
                    Wybierz Premium B2B <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-surface-200 bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-surface-500 text-sm">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-6 text-xs text-surface-600">
            <a href="https://veritas-app.com/eva" target="_blank" rel="noreferrer" className="hover:text-gold-600 transition-colors">
              O projekcie EVA
            </a>
            <span className="text-surface-300">•</span>
            <Link to="/dashboard/guide" className="hover:text-gold-600 transition-colors">
              Instrukcja Wdrożenia
            </Link>
            <span className="text-surface-300">•</span>
            <a href="https://veritas-app.com/eva/regulamin" target="_blank" rel="noreferrer" className="hover:text-gold-600 transition-colors">
              Regulamin B2B i RODO
            </a>
            <span className="text-surface-300">•</span>
            <a href="tel:+48343433088" className="hover:text-gold-600 transition-colors font-medium">
              Infolinia DEMO AI: +48 34 343 30 88
            </a>
          </div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-surface-100 text-surface-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <span className="font-medium text-surface-900">
              Powered by <a href="https://veritas-app.com" target="_blank" rel="noreferrer" className="text-gold-600 hover:text-gold-500 transition-colors">Veritas App</a>
            </span>
          </div>
          © 2026 Veritas App. Wszelkie prawa zastrzeżone.
        </div>
      </footer>

      {/* --- MODAL INSTALACJI PWA NA TELEFONACH --- */}
      {showInstallModal && !isStandalone && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-surface-200 relative my-auto animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
            <button 
              type="button" 
              onClick={handleDismiss} 
              className="absolute top-4 right-4 text-surface-400 hover:text-surface-700 p-2 rounded-full hover:bg-surface-100 transition"
              aria-label="Zamknij"
            >
              <X className="w-5 h-5" />
            </button>

            {!showIosGuide && !showAndroidManualGuide ? (
              // Główny widok zaproszenia do instalacji PWA
              <div>
                <div className="flex items-center gap-3.5 mb-4">
                  <img src="/EVA_favicon_192.png" alt="EVA Logo" className="w-14 h-14 rounded-2xl shadow-md border border-surface-200 shrink-0" />
                  <div>
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider mb-0.5">
                      <Sparkles className="w-3 h-3 text-amber-600" /> Aplikacja Mobilna PWA
                    </div>
                    <h3 className="text-xl font-serif font-bold text-surface-900 leading-tight">
                      Zainstaluj EasyVoice
                    </h3>
                    <p className="text-xs text-surface-500">Asystent Głosowy AI & Centrala</p>
                  </div>
                </div>

                <p className="text-sm text-surface-600 leading-relaxed mb-4">
                  Zainstaluj aplikację na telefonie, aby uzyskać natywny pełnoekranowy widok, natychmiastowe powiadomienia push o połączeniach i szybki dostęp bez wpisywania adresu.
                </p>

                <div className="bg-surface-50 border border-surface-200/80 rounded-2xl p-3.5 mb-5 space-y-2 text-xs text-surface-700">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Dostęp jednym kliknięciem z ekranu głównego</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Ciemny, elegancki pasek systemowy (nocny/OLED)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Automatyczne powiadomienia Push o nowych sprawach</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="w-full py-3.5 px-4 bg-primary text-primary-foreground hover:bg-surface-800 font-bold rounded-2xl shadow-lg shadow-surface-900/10 flex items-center justify-center gap-2 text-base transition active:scale-[0.98]"
                  >
                    <Download className="w-5 h-5" />
                    Zainstaluj aplikację
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-full py-2.5 px-4 text-surface-500 hover:text-surface-800 text-xs font-semibold rounded-xl hover:bg-surface-100 transition"
                  >
                    Kontynuuj w przeglądarce
                  </button>
                </div>
              </div>
            ) : showIosGuide ? (
              // Instrukcja instalacji dla iPhone / iPad (iOS Safari)
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-surface-900">
                      Jak zainstalować na iPhone?
                    </h3>
                    <p className="text-xs text-surface-500">Instrukcja w przeglądarce Safari (iOS)</p>
                  </div>
                </div>

                <p className="text-xs text-surface-600 mb-4 leading-relaxed">
                  System iOS wymaga dodania aplikacji przez menu Safari w 3 prostych krokach:
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-2xl border border-surface-200">
                    <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-xs text-surface-700">
                      Kliknij przycisk <strong>Udostępnij</strong> (<Share className="w-3.5 h-3.5 inline text-blue-600 mb-0.5" /> kwadrat ze strzałką w górę) na dolnym pasku Safari.
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-2xl border border-surface-200">
                    <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-xs text-surface-700">
                      Przewiń menu w dół i wybierz opcję <strong>„Do ekranu początkowego”</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-surface-700 mb-0.5" /> Add to Home Screen).
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-2xl border border-surface-200">
                    <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="text-xs text-surface-700">
                      W prawym górnym rogu kliknij <strong>„Dodaj”</strong>. Ikona EVA pojawi się na Twoim pulpicie!
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full py-3 px-4 bg-surface-900 text-white font-bold rounded-2xl text-sm transition hover:bg-surface-800 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Rozumiem, zamknij
                </button>
              </div>
            ) : (
              // Instrukcja manualna dla Android (gdy prompt nie zadziałał z automatu)
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-surface-900">
                      Instalacja aplikacji Android
                    </h3>
                    <p className="text-xs text-surface-500">W Twojej przeglądarce Chrome / Edge</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-2xl border border-surface-200">
                    <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-xs text-surface-700">
                      Kliknij <strong>menu przeglądarki</strong> (trzy kropki ⋮ w prawym górnym rogu ekranu).
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-2xl border border-surface-200">
                    <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-xs text-surface-700">
                      Wybierz opcję <strong>„Zainstaluj aplikację”</strong> lub <strong>„Dodaj do ekranu głównego”</strong>.
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-surface-50 rounded-2xl border border-surface-200">
                    <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="text-xs text-surface-700">
                      Potwierdź klikając <strong>„Zainstaluj”</strong>. Aplikacja otworzy się jak aplikacja natywna!
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full py-3 px-4 bg-surface-900 text-white font-bold rounded-2xl text-sm transition hover:bg-surface-800 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Rozumiem, zamknij
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
