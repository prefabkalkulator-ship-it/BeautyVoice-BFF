import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Circle, ArrowRight, Sparkles, ChevronDown, ChevronUp, X, BookOpen } from 'lucide-react';

interface StepStatus {
  id: string;
  title: string;
  desc: string;
  path: string;
  isDone: boolean;
}

export default function OnboardingBanner() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [hasProfile, setHasProfile] = useState(false);
  const [hasFaq, setHasFaq] = useState(false);
  const [hasServices, setHasServices] = useState(false);
  const [hasStaffWithServices, setHasStaffWithServices] = useState(false);
  const [hasTimeOff, setHasTimeOff] = useState(false);

  useEffect(() => {
    const syncState = () => {
      const dismissed = localStorage.getItem('onboarding_dismissed') === 'true';
      setIsDismissed(dismissed);
      const collapsed = localStorage.getItem('onboarding_collapsed') === 'true';
      setIsCollapsed(collapsed);
    };

    syncState();
    window.addEventListener('onboarding_state_changed', syncState);
    return () => window.removeEventListener('onboarding_state_changed', syncState);
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [tenRes, faqRes, svcRes, staffRes, toRes] = await Promise.allSettled([
          fetch('/api/tenant').then(r => r.ok ? r.json() : null),
          fetch('/api/faq').then(r => r.ok ? r.json() : []),
          fetch('/api/services').then(r => r.ok ? r.json() : []),
          fetch('/api/staff').then(r => r.ok ? r.json() : []),
          fetch('/api/timeoff').then(r => r.ok ? r.json() : [])
        ]);

        const tenant = tenRes.status === 'fulfilled' ? tenRes.value : null;
        const faqs = faqRes.status === 'fulfilled' && Array.isArray(faqRes.value) ? faqRes.value : [];
        const services = svcRes.status === 'fulfilled' && Array.isArray(svcRes.value) ? svcRes.value : [];
        const staff = staffRes.status === 'fulfilled' && Array.isArray(staffRes.value) ? staffRes.value : [];
        const timeoffs = toRes.status === 'fulfilled' && Array.isArray(toRes.value) ? toRes.value : [];

        // 1. Profil firmy
        setHasProfile(Boolean(tenant && tenant.name && tenant.businessProfile));
        // 2. Baza wiedzy EVA
        setHasFaq(faqs.length > 0);
        // 3. Usługi i cennik
        setHasServices(services.length > 0);
        // 4. Zespół i zasoby (czy pracownicy mają przypisane usługi lub profil solo z usługami)
        const staffAssigned = staff.length > 0 && staff.some((s: any) => 
          (Array.isArray(s.services) && s.services.length > 0) ||
          (Array.isArray(s.serviceIds) && s.serviceIds.length > 0)
        );
        setHasStaffWithServices(staffAssigned || (tenant?.businessProfile === 'solo' && services.length > 0));
        // 5. Dni wolne
        setHasTimeOff(timeoffs.length > 0);
      } catch (err) {
        console.error('Error checking onboarding status:', err);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [location.pathname]);

  // Kolejność: Profil → Baza wiedzy → Usługi → Zespół → Dni wolne
  const steps: StepStatus[] = [
    {
      id: 'profile',
      title: '1. Profil Firmy',
      desc: 'Wypełnij profil działalności, opis i kontakt.',
      path: '/dashboard/settings',
      isDone: hasProfile
    },
    {
      id: 'faq',
      title: '2. Baza Wiedzy EVA',
      desc: 'Czat AI sam wykryje i uzupełni usługi oraz FAQ z Twoich materiałów.',
      path: '/dashboard/faq',
      isDone: hasFaq
    },
    {
      id: 'services',
      title: '3. Usługi i Cennik',
      desc: 'Sprawdź i dostosuj cennik oraz czasy trwania usług.',
      path: '/dashboard/services',
      isDone: hasServices
    },
    {
      id: 'staff',
      title: '4. Zespół i Zasoby',
      desc: 'Ustal grafiki pracowników i przypisz im usługi.',
      path: '/dashboard/settings',
      isDone: hasStaffWithServices
    },
    {
      id: 'timeoff',
      title: '5. Dni Wolne i Święta',
      desc: 'Oznacz urlopy i święta, by asystent nie proponował terminów.',
      path: '/dashboard/timeoff',
      isDone: hasTimeOff
    }
  ];

  const completedCount = steps.filter(s => s.isDone).length;
  const nextStep = steps.find(s => !s.isDone) || steps[0];
  const allDone = completedCount === steps.length;

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('onboarding_dismissed', 'true');
    window.dispatchEvent(new Event('onboarding_state_changed'));
  };

  const handleRestore = () => {
    setIsDismissed(false);
    localStorage.removeItem('onboarding_dismissed');
    window.dispatchEvent(new Event('onboarding_state_changed'));
  };

  const handleToggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('onboarding_collapsed', next ? 'true' : 'false');
    window.dispatchEvent(new Event('onboarding_state_changed'));
  };

  if (loading) return null;

  // Widok zminimalizowany po zamknięciu (pozwala błyskawicznie otworzyć pasek z powrotem!)
  if (isDismissed) {
    return (
      <div className="mb-6 bg-gradient-to-r from-amber-500/5 via-gold-500/10 to-amber-500/5 border border-gold-300/80 rounded-2xl p-3 sm:px-4 sm:py-3 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-150">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gold-100 text-gold-800 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-surface-900 flex flex-wrap items-center gap-2">
              Kolejność wdrożenia asystenta EVA
              <span className="text-[11px] font-sans font-semibold px-2 py-0.5 rounded-full bg-gold-100 text-gold-900 border border-gold-200">
                {completedCount} z {steps.length} kroków
              </span>
              {allDone && (
                <span className="text-[11px] font-sans font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-900 border border-green-200">
                  Gotowe!
                </span>
              )}
            </div>
            <p className="text-[11px] text-surface-500 mt-0.5">
              Pasek pierwszych kroków został ukryty. Kliknij obok, aby go ponownie otworzyć.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleRestore}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-900 text-white hover:bg-surface-800 text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-gold-300" />
            Otwórz pasek wdrożenia (5 kroków)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-gradient-to-r from-amber-500/10 via-gold-500/10 to-amber-500/10 border-2 border-gold-400/50 rounded-3xl p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-400 to-amber-600 text-white flex items-center justify-center shadow-md shadow-gold-500/20 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-surface-900 text-base flex flex-wrap items-center gap-2">
              Kolejność wdrożenia asystenta EVA
              <span className="text-xs font-sans font-semibold px-2.5 py-0.5 rounded-full bg-gold-100 text-gold-900 border border-gold-300">
                {completedCount} z {steps.length} kroków
              </span>
            </h3>
            <p className="text-xs text-surface-600 mt-0.5">
              {allDone 
                ? 'Gratulacje! Wszystkie etapy konfiguracji zostały zrealizowane. Twój asystent jest w pełni gotowy do pracy!'
                : 'Zalecana kolejność: Profil → Baza wiedzy → Usługi → Zespół → Dni wolne.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto shrink-0">
          {!allDone && (
            <button
              onClick={() => navigate(nextStep.path)}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-surface-900 text-white hover:bg-surface-800 hover:text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
            >
              Przejdź do: {nextStep.title.split('. ')[1]} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard/guide')}
            className="inline-flex items-center gap-1 text-xs text-gold-900 hover:text-white hover:bg-gold-600 font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-gold-100 border border-gold-300 transition cursor-pointer"
            title="Otwórz pełną instrukcję"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden md:inline">Instrukcja</span>
          </button>
          <button
            onClick={handleToggleCollapse}
            className="p-1.5 sm:p-2 text-surface-500 hover:text-surface-900 rounded-xl hover:bg-white/80 transition cursor-pointer"
            title={isCollapsed ? 'Rozwiń' : 'Zwiń'}
          >
            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 sm:p-2 text-surface-500 hover:text-red-600 rounded-xl hover:bg-red-50 transition cursor-pointer"
            title="Ukryj przewodnik"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Pasek postępu */}
      <div className="w-full bg-surface-200/80 rounded-full h-2 mt-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-gold-500 to-amber-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      {/* Rozwinięte kafelki kroków */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4 pt-3 border-t border-gold-200/50">
          {steps.map((s) => {
            const isCurrent = !allDone && s.id === nextStep.id;
            return (
              <div
                key={s.id}
                onClick={() => navigate(s.path)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  s.isDone
                    ? 'bg-white/90 border-green-300 hover:bg-white shadow-2xs'
                    : isCurrent
                    ? 'bg-white border-gold-500 ring-2 ring-gold-400/40 shadow-sm'
                    : 'bg-white/60 border-surface-200 hover:bg-white/90'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {s.isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  ) : (
                    <Circle className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-gold-600 font-bold' : 'text-surface-400'}`} />
                  )}
                  <span className={`text-xs font-bold truncate ${s.isDone ? 'text-green-900' : isCurrent ? 'text-gold-950' : 'text-surface-700'}`}>
                    {s.title}
                  </span>
                </div>
                <p className="text-[11px] text-surface-600 line-clamp-2 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
