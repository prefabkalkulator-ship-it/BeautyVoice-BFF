import { useState } from 'react';
import { Calendar, ClipboardList, HelpCircle, MessageSquare, Menu, Phone, CreditCard, LogOut, Settings, CalendarDays } from 'lucide-react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';

export default function DashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { id: 'appointments', path: '/dashboard/appointments', label: 'Rezerwacje', icon: Calendar },
    { id: 'services', path: '/dashboard/services', label: 'Usługi', icon: ClipboardList },
    { id: 'faq', path: '/dashboard/faq', label: 'Baza Wiedzy', icon: HelpCircle },
    { id: 'simulator', path: '/dashboard/simulator', label: 'Symulator', icon: MessageSquare },
    { id: 'settings', path: '/dashboard/settings', label: 'Ustawienia Firmy', icon: Settings },
    { id: 'timeoff', path: '/dashboard/timeoff', label: 'Dni Wolne', icon: CalendarDays },
    { id: 'subscription', path: '/dashboard/subscription', label: 'Subskrypcja', icon: CreditCard },
  ];

  const handleLogout = () => {
    // TODO: supabase.auth.signOut()
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col md:flex-row font-sans">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-surface-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Phone className="text-gold-600 w-6 h-6" />
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
          <div className="bg-gold-50 p-2 rounded-xl text-gold-600">
            <Phone className="w-6 h-6" />
          </div>
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

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
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
