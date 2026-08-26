import { useState, useEffect } from 'react';
import { Phone, Building2, ArrowRight, Loader2, X, Lock } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isLogin, setIsLogin] = useState(location.pathname === '/login');
  
  const [salonName, setSalonName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setIsLogin(location.pathname === '/login');
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin 
        ? { phoneNumber, pinCode }
        : { name: salonName, phoneNumber, pinCode };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
if (!res.ok) {
        throw new Error(data.error || 'Błąd uwierzytelniania');
      }

      if (data.tenantId) {
        localStorage.setItem('tenantId', data.tenantId);
      }
      
      navigate('/dashboard/subscription');
      
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas uwierzytelniania');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-gold-200 relative">
      <Link to="/" className="absolute top-6 right-6 p-2 rounded-full text-surface-400 hover:text-surface-900 hover:bg-surface-200 transition-colors">
        <X className="w-6 h-6" />
      </Link>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex items-center justify-center gap-3 group">
          <img src="/EVA_favicon_192.png" alt="EVA Logo" className="w-12 h-12 rounded-2xl shadow-sm group-hover:scale-105 transition-transform" />
          <span className="font-serif text-3xl text-surface-900 flex items-baseline">
            E<span className="text-[0.65em]">asy</span>V<span className="text-[0.65em]">oice</span>A<span className="text-[0.65em]">ssistant</span>
          </span>
        </Link>
        <h2 className="mt-8 text-center text-3xl font-serif text-surface-900 tracking-tight">
          {isLogin ? 'Zaloguj się' : 'Załóż konto'}
        </h2>
        <p className="mt-2 text-center text-sm text-surface-500">
          {isLogin ? 'Wprowadź swój numer telefonu i kod PIN.' : 'Uzupełnij dane, wybierz plan abonamentowy i zatrudnij asystentkę od zaraz.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-card py-8 px-4 shadow-xl shadow-surface-200/50 sm:rounded-3xl sm:px-10 border border-white">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-surface-700">Nazwa firmy</label>
                <div className="mt-2 relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    required={!isLogin}
                    value={salonName}
                    onChange={(e) => setSalonName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-colors bg-white/50 focus:bg-white"
                    placeholder="Studio Urody EVA"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-surface-700">Numer telefonu</label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                  <Phone className="h-5 w-5" />
                </div>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-colors bg-white/50 focus:bg-white"
                  placeholder="+48 111 222 333"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700">Zabezpieczenie (PIN / NIP)</label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  required
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-colors bg-white/50 focus:bg-white"
                  placeholder="****"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-surface-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-surface-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {isLogin ? 'Wejdź na konto' : 'Załóż konto i wybierz plan'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-gold-600 hover:text-gold-700 font-medium transition-colors"
            >
              {isLogin ? 'Nie masz konta? Zarejestruj się' : 'Masz już konto? Zaloguj się'}
            </button>
          </div>
          
           {!isLogin && (
             <p className="mt-6 text-center text-xs text-surface-400">
               Klikając "Załóż konto", akceptujesz nasz Regulamin oraz Politykę Prywatności.
             </p>
           )}
        </div>
      </div>
    </div>
  );
}
