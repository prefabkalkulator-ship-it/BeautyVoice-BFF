import { useState, useEffect } from 'react';
import { Phone, Building2, ArrowRight, Loader2, X, Lock, KeyRound, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isLogin, setIsLogin] = useState(location.pathname === '/login');
  const [isForgotPin, setIsForgotPin] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  
  const [salonName, setSalonName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pinCode, setPinCode] = useState('');
  
  // Stany dla resetowania PIN
  const [resetSmsCode, setResetSmsCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setIsLogin(location.pathname === '/login');
    setIsForgotPin(false);
    setForgotStep(1);
    setError('');
    setSuccessMsg('');
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

  // Krok 1 resetowania PIN: Wysłanie kodu SMS
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) {
      setError('Podaj numer telefonu zarejestrowany w aplikacji.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/forgot-pin/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się wysłać kodu SMS');
      }
      setResetSmsCode('');
      setNewPin('');
      setConfirmNewPin('');
      setSuccessMsg('Kod weryfikacyjny został wysłany SMS-em na Twój numer telefonu.');
      setForgotStep(2);
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas wysyłania SMS');
    } finally {
      setLoading(false);
    }
  };

  // Krok 2 resetowania PIN: Weryfikacja kodu SMS i ustawienie nowego PIN
  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetSmsCode || !newPin) {
      setError('Wpisz kod SMS oraz nowy PIN.');
      return;
    }
    if (newPin.length < 4) {
      setError('PIN musi zawierać minimum 4 cyfry.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setError('Podane kody PIN nie są identyczne.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/forgot-pin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code: resetSmsCode, newPin })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Błąd zmiany kodu PIN');
      }

      if (data.tenantId) {
        localStorage.setItem('tenantId', data.tenantId);
      }
      setSuccessMsg('Kod PIN zmieniony pomyślnie! Logowanie...');
      setTimeout(() => {
        navigate('/dashboard/appointments');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Błąd weryfikacji kodu SMS');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-gold-200 relative">
      <Link to="/" className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full text-surface-400 hover:text-surface-900 hover:bg-surface-200 transition-colors z-10">
        <X className="w-6 h-6" />
      </Link>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex items-center justify-center gap-3 group">
          <img src="/EVA_favicon_192.png" alt="EVA Logo" className="w-12 h-12 rounded-2xl shadow-sm group-hover:scale-105 transition-transform" />
          <span className="font-serif text-3xl text-surface-900 flex items-baseline">
            E<span className="text-[0.65em]">asy</span>V<span className="text-[0.65em]">oice</span>A<span className="text-[0.65em]">ssistant</span>
          </span>
        </Link>

        {isForgotPin ? (
          <>
            <h2 className="mt-8 text-center text-3xl font-serif text-surface-900 tracking-tight">
              Resetowanie kodu PIN
            </h2>
            <p className="mt-2 text-center text-sm text-surface-500">
              {forgotStep === 1 
                ? 'Wpisz numer telefonu zarejestrowany w systemie, aby otrzymać kod weryfikacyjny SMS.'
                : `Wpisz 6-cyfrowy kod wysłany na numer ${phoneNumber} i ustal nowy PIN.`}
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-8 text-center text-3xl font-serif text-surface-900 tracking-tight">
              {isLogin ? 'Zaloguj się' : 'Załóż konto'}
            </h2>
            <p className="mt-2 text-center text-sm text-surface-500">
              {isLogin ? 'Wprowadź swój numer telefonu i kod PIN.' : 'Uzupełnij dane, wybierz plan abonamentowy i zatrudnij asystentkę od zaraz.'}
            </p>
          </>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-card py-8 px-4 shadow-xl shadow-surface-200/50 sm:rounded-3xl sm:px-10 border border-white">
          
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {isForgotPin ? (
            /* WIDOK RESETOWANIA KODU PIN */
            forgotStep === 1 ? (
              <form className="space-y-6" onSubmit={handleRequestOtp}>
                <div>
                  <label className="block text-sm font-medium text-surface-700">Numer telefonu firmy</label>
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-surface-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-surface-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      Wyślij kod weryfikacyjny SMS
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setIsForgotPin(false); setError(''); setSuccessMsg(''); }}
                    className="inline-flex items-center gap-1.5 text-sm text-surface-600 hover:text-surface-900 font-medium transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Wróć do logowania
                  </button>
                </div>
              </form>
            ) : (
              <form className="space-y-5" onSubmit={handleVerifyOtpAndReset} autoComplete="off">
                <div>
                  <label className="block text-sm font-medium text-surface-700">Kod weryfikacyjny SMS (6 cyfr)</label>
                  <div className="mt-2 relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      name="otp-sms-code"
                      id="otp-sms-code"
                      autoComplete="one-time-code"
                      required
                      maxLength={6}
                      value={resetSmsCode}
                      onChange={(e) => setResetSmsCode(e.target.value.replace(/\D/g, ''))}
                      className="block w-full pl-10 pr-3 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-colors bg-white/50 focus:bg-white font-mono text-center tracking-widest text-lg"
                      placeholder="******"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700">Nowy kod PIN (min. 4 cyfry)</label>
                  <div className="mt-2 relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      name="new-security-pin"
                      id="new-security-pin"
                      autoComplete="new-password"
                      required
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="block w-full pl-10 pr-3 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-colors bg-white/50 focus:bg-white font-mono tracking-widest text-center"
                      placeholder="****"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700">Powtórz nowy kod PIN</label>
                  <div className="mt-2 relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      name="confirm-security-pin"
                      id="confirm-security-pin"
                      autoComplete="new-password"
                      required
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                      className="block w-full pl-10 pr-3 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-colors bg-white/50 focus:bg-white font-mono tracking-widest text-center"
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
                      Zapisz nowy PIN i zaloguj się
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex justify-between items-center text-xs text-surface-500 pt-2">
                  <button
                    type="button"
                    onClick={() => { setForgotStep(1); setError(''); }}
                    className="hover:text-surface-900 underline"
                  >
                    Wyślij kod SMS ponownie
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsForgotPin(false); setError(''); setSuccessMsg(''); }}
                    className="hover:text-surface-900 underline"
                  >
                    Wróć do logowania
                  </button>
                </div>
              </form>
            )
          ) : (
            /* WIDOK LOGOWANIA I REJESTRACJI */
            <form className="space-y-6" onSubmit={handleSubmit}>
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
                      placeholder="Np. Twoja Firma, Gabinet, Kancelaria, Salon"
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
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-surface-700">Zabezpieczenie (PIN / NIP)</label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPin(true);
                        setForgotStep(1);
                        setError('');
                        setSuccessMsg('');
                      }}
                      className="text-xs text-gold-600 hover:text-gold-700 hover:underline font-medium transition-colors"
                    >
                      Zapomniałeś PIN?
                    </button>
                  )}
                </div>
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
          )}
          
          {!isForgotPin && (
            <div className="mt-6 text-center">
              <button 
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className="text-sm text-gold-600 hover:text-gold-700 font-medium transition-colors"
              >
                {isLogin ? 'Nie masz konta? Zarejestruj się' : 'Masz już konto? Zaloguj się'}
              </button>
            </div>
          )}
          
          {!isLogin && !isForgotPin && (
            <p className="mt-6 text-center text-xs text-surface-400">
              Klikając "Załóż konto", akceptujesz nasz Regulamin oraz Politykę Prywatności.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
