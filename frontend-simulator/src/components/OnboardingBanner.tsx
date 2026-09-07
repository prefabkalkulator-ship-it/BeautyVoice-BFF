import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Circle, ArrowRight, Sparkles, ChevronDown, ChevronUp, X, HelpCircle, BookOpen } from 'lucide-react';

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

  const [hasServices, setHasServices] = useState(false);
  const [hasFaq, setHasFaq] = useState(false);
  const [hasStaffWithServices, setHasStaffWithServices] = useState(false);
  const [hasTimeOff, setHasTimeOff] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('onboarding_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
    const collapsed = localStorage.getItem('onboarding_collapsed');
    if (collapsed === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [tenRes, svcRes, faqRes, staffRes, toRes] = await Promise.allSettled([
          fetch('/api/tenant').then(r => r.ok ? r.json() : null),
          fetch('/api/services').then(r => r.ok ? r.json() : []),
          fetch('/api/faq').then(r => r.ok ? r.json() : []),
          fetch('/api/staff').then(r => r.ok ? r.json() : []),
          fetch('/api/timeoff').then(r => r.ok ? r.json() : [])
        ]);

        const tenant = tenRes.status === 'fulfilled' ? tenRes.value : null;
        const services = svcRes.status === 'fulfilled' && Array.isArray(svcRes.value) ? svcRes.value : [];
        const faqs = faqRes.status === 'fulfilled' && Array.isArray(faqRes.value) ? faqRes.value : [];
        const staff = staffRes.status === 'fulfilled' && Array.isArray(staffRes.value) ? staffRes.value : [];
        const timeoffs = toRes.status === 'fulfilled' && Array.isArray(toRes.value) ? toRes.value : [];

        // 1. Profil firmy
        setHasProfile(Boolean(tenant && tenant.name && tenant.businessProfile));
        // 2. Usługi
        setHasServices(services.length > 0);
        // 3. Baza wiedzy
        setHasFaq(faqs.length > 0);
        // 4. Zespół (czy jest staff i czy ma przypisane usługi)
        const staffAssigned = staff.length > 0 && staff.some((s: any) => s.serviceIds && s.serviceIds.length > 0);
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

  if (isDismissed || loading) return null;

  const steps: StepStatus[] = [
    {
      id: 'profile',
      title: '1. Profil Firmy i Godziny',
      desc: 'Wypełnij profil działalności i godziny otwarcia.',
      path: '/dashboard/settings',
      isDone: hasProfile
    },
    {
      id: 'services',
      title: '2. Usługi i Cennik',
      desc: 'Dodaj usługi z czasem trwania i ceną.',
      path: '/dashboard/services',
      isDone: hasServices
    },
    {
      id: 'faq',
      title: '3. Baza Wiedzy EVA',
      desc: 'Naucz asystenta odpowiedzi na pytania klientów.',
      path: '/dashboard/faq',
      isDone: hasFaq
    },
    {
      id: 'staff',
      title: '4. Zespół i Zasoby',
      desc: 'Przypisz zdefiniowane usługi do pracowników.',
      path: '/dashboard/settings',
      isDone: hasStaffWithServices
    },
    {
      id: 'timeoff',
      title: '5. Dni Wolne i Święta',
      desc: 'Oznacz urlopy i święta, by asystent nie zapisywał.',
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
  };

  const handleToggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('onboarding_collapsed', next ? 'true' : 'false');
  };

  return (
    <div className="mb-6 bg-gradient-to-r from-amber-500/10 via-gold-500/10 to-amber-500/10 border-2 border-gold-400/40 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-400 to-amber-600 text-white flex items-center justify-center shadow-md shadow-gold-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-surface-900 text-base flex items-center gap-2">
              Kolejność wdrożenia asystenta EVA
              <span className="text-xs font-sans font-semibold px-2.5 py-0.5 rounded-full bg-gold-100 text-gold-800 border border-gold-200">
                {completedCount} z {steps.length} kroków
              </span>
            </h3>
            <p className="text-xs text-surface-600 mt-0.5">
              {allDone 
                ? 'Gratulacje! Wszystkie etapy konfiguracji zostały zrealizowane. Twój asystent jest w pełni gotowy do pracy!'
                : `Zalecana kolejność: Profil → Usługi → Baza wiedzy → Zespół → Dni wolne.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!allDone && (
            <button
              onClick={() => navigate(nextStep.path)}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-surface-800 transition shadow-sm"
            >
              Przejdź do: {nextStep.title.split('. ')[1]} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard/guide')}
            className="inline-flex items-center gap-1 text-xs text-gold-700 hover:text-gold-900 font-medium px-2.5 py-1.5 rounded-lg hover:bg-gold-100/60 transition"
            title="Otwórz pełną instrukcję"
          >
            <BookOpen className="w-4 h-4 text-gold-600" />
            <span className="hidden md:inline">Instrukcja</span>
          </button>
          <button
            onClick={handleToggleCollapse}
            className="p-1.5 text-surface-400 hover:text-surface-700 rounded-lg hover:bg-surface-100 transition"
            title={isCollapsed ? 'Rozwiń' : 'Zwiń'}
          >
            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-surface-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
            title="Zamknij przewodnik"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Pasek postępu */}
      <div className="w-full bg-surface-200/80 rounded-full h-1.5 mt-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-gold-500 to-amber-600 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      {/* Rozwinięte kafelki kroków */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4 pt-3 border-t border-gold-200/40">
          {steps.map((s, idx) => {
            const isCurrent = !allDone && s.id === nextStep.id;
            return (
              <div
                key={s.id}
                onClick={() => navigate(s.path)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  s.isDone
                    ? 'bg-white/80 border-green-200 hover:bg-white hover:border-green-300'
                    : isCurrent
                    ? 'bg-white border-gold-400 ring-2 ring-gold-400/30 shadow-sm'
                    : 'bg-white/50 border-surface-200 hover:bg-white/80'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {s.isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  ) : (
                    <Circle className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-gold-600 font-bold' : 'text-surface-300'}`} />
                  )}
                  <span className={`text-xs font-bold truncate ${s.isDone ? 'text-green-900' : isCurrent ? 'text-gold-900' : 'text-surface-700'}`}>
                    {s.title}
                  </span>
                </div>
                <p className="text-[11px] text-surface-500 line-clamp-2 leading-snug">
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
