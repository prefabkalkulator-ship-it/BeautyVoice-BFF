import { useState } from 'react';
import { Calendar, ClipboardList, HelpCircle, MessageSquare, Menu, Phone, CreditCard, LogOut, Settings, CalendarDays, Users, BookOpen } from 'lucide-react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { requestForToken, onMessageListener } from '../firebase';
import toast, { Toaster } from 'react-hot-toast';
import OnboardingBanner from '../components/OnboardingBanner';

export default function DashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const callNumber = searchParams.get('call');
    if (callNumber) {
      toast('Przygotowuję połączenie... Potwierdź uruchomienie telefonu w oknie systemowym.', { icon: '📞', duration: 4000 });
      setTimeout(() => {
        window.location.href = 'tel:' + callNumber;
      }, 500);
      searchParams.delete('call');
      navigate({ search: searchParams.toString() }, { replace: true });
    }
  }, [location.search, navigate]);

  
  useEffect(() => {
    const tid = localStorage.getItem('tenantId');
    if (!tid) {
      navigate('/login');
      return;
    }
    // Verify tenant still exists in DB and check suspension status
    fetch('/api/tenant').then(r => {
      if (r.status === 404 || r.status === 401) {
        localStorage.removeItem('tenantId');
        navigate('/login');
        return;
      }
      return r.json();
    }).then(t => {
      if (t && t.isSuspended) {
        setIsSuspended(true);
      } else {
        setIsSuspended(false);
      }
    }).catch(() => {});
  }, [navigate]);


  const [minutesUsed, setMinutesUsed] = useState(0);
  const [minutesIncluded, setMinutesIncluded] = useState(0);
  const [isSuspended, setIsSuspended] = useState(false);

  useEffect(() => {
    requestForToken();
    onMessageListener().then((payload: any) => {
      toast.success(`${payload?.notification?.title}: ${payload?.notification?.body}`, { duration: 6000 });
    }).catch(err => console.log('Błąd listenera', err));
  }, []);

  useEffect(() => {
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => {
        if (d && typeof d.minutesUsed === 'number') {
          setMinutesUsed(d.minutesUsed);
          setMinutesIncluded(d.minutesIncluded || 0);
        }
      })
      .catch(() => {});
  }, []);

  const tabs = [
    { id: 'appointments', path: '/dashboard/appointments', label: 'Rezerwacje', icon: Calendar },
    { id: 'services', path: '/dashboard/services', label: 'Usługi', icon: ClipboardList },
    { id: 'customers', path: '/dashboard/customers', label: 'Klienci', icon: Users },
    { id: 'faq', path: '/dashboard/faq', label: 'Baza Wiedzy', icon: HelpCircle },
    { id: 'simulator', path: '/dashboard/simulator', label: 'Marketing AI', icon: MessageSquare },
    { id: 'settings', path: '/dashboard/settings', label: 'Ustawienia Firmy', icon: Settings },
    { id: 'timeoff', path: '/dashboard/timeoff', label: 'Dni Wolne', icon: CalendarDays },
    { id: 'subscription', path: '/dashboard/subscription', label: 'Subskrypcja', icon: CreditCard },
    { id: 'guide', path: '/dashboard/guide', label: 'Instrukcja', icon: BookOpen },
  ];

  const handleLogout = () => {
    localStorage.removeItem('tenantId');
    // TODO: supabase.auth.signOut()
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col md:flex-row font-sans">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-surface-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src="/EVA_favicon_192.png" alt="EVA Logo" className="w-8 h-8 rounded-lg" />
          <span className="font-serif font-semibold text-lg text-surface-900 flex items-baseline">
            E<span className="text-[0.65em]">asy</span>V<span className="text-[0.65em]">oice</span>A<span className="text-[0.65em]">ssistant</span>
          </span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-surface-600">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-surface-200 flex flex-col transition-transform duration-300
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-surface-100 flex items-center gap-3">
          <img src="/EVA_favicon_192.png" alt="EVA Logo" className="w-10 h-10 rounded-xl shadow-sm" />
          <div>
            <h1 className="font-serif font-semibold text-xl text-surface-900 leading-none flex items-baseline">
              E<span className="text-[0.65em]">asy</span>V<span className="text-[0.65em]">oice</span>A<span className="text-[0.65em]">ssistant</span>
            </h1>
            <span className="text-xs text-surface-500 font-medium tracking-wide uppercase">Dashboard</span>
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-4 px-3">Menu Główne</div>
          <nav className="space-y-1 flex-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = location.pathname.includes(tab.path);
              return (
                <Link
                  key={tab.id}
                  to={tab.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? 'bg-surface-900 text-white shadow-md shadow-surface-900/10' 
                      : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'}
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-gold-300' : 'text-surface-400'}`} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-surface-100 pt-4 mt-auto">
             <div className="px-3 mb-4 flex items-center justify-between text-sm text-surface-600 bg-surface-50 p-2.5 rounded-xl border border-surface-200 shadow-sm">
               <span className="font-medium">Minuty:</span>
               <span className="font-bold text-surface-900">{minutesUsed} / {minutesIncluded}</span>
             </div>
             <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5 opacity-80" />
                Wyloguj się
              </button>
          </div>
        </div>
      </aside>

      <Toaster />
      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {isSuspended && (
          <div className="mb-6 bg-red-600 text-white p-4 rounded-2xl shadow-lg flex items-center gap-4">
            <span className="text-3xl">🚫</span>
            <div>
              <h4 className="font-bold text-base sm:text-lg">Konto zostało zawieszone przez administratora platformy</h4>
              <p className="text-xs sm:text-sm text-red-100 mt-1">
                Połączenia telefoniczne, asystent głosowy AI oraz kampanie SMS zostały wstrzymane. Skontaktuj się z administratorem, aby wyjaśnić status i odblokować konto.
              </p>
            </div>
          </div>
        )}
        <OnboardingBanner />
        <Outlet />
      </main>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-surface-900/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
