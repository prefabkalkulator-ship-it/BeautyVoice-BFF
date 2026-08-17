import { useState } from 'react';
import { Bot, Mail, Lock, ArrowRight, Loader2, X } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLogin = location.pathname === '/login';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // TODO: Podłączenie docelowe pod supabase.auth.signUp / signIn
      // Tymczasowy mock logowania:
      setTimeout(() => {
        setLoading(false);
        // Symulacja udanego logowania - przekierowanie do panelu
        navigate('/dashboard');
      }, 1000);
      
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas uwierzytelniania');
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
          <div className="w-12 h-12 rounded-2xl bg-gold-100 text-gold-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Bot className="w-7 h-7" />
          </div>
          <span className="font-serif text-3xl text-surface-900">BeautyVoice</span>
        </Link>
        <h2 className="mt-8 text-center text-3xl font-serif text-surface-900 tracking-tight">
          {isLogin ? 'Zaloguj się do panelu' : 'Stwórz darmowe konto'}
        </h2>
        <p className="mt-2 text-center text-sm text-surface-500">
          {isLogin ? 'Nie masz jeszcze konta? ' : 'Masz już konto? '}
          <Link to={isLogin ? '/register' : '/login'} className="font-medium text-gold-600 hover:text-gold-500 transition-colors">
            {isLogin ? 'Zarejestruj się za darmo' : 'Zaloguj się'}
          </Link>
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
            
            <div>
              <label className="block text-sm font-medium text-surface-700">Adres email</label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-colors bg-white/50 focus:bg-white"
                  placeholder="twojsalon@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700">Hasło</label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-colors bg-white/50 focus:bg-white"
                  placeholder="••••••••"
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
                  {isLogin ? 'Zaloguj się' : 'Rozpocznij 7-dniowy okres próbny'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          
          {!isLogin && (
             <p className="mt-6 text-center text-xs text-surface-400">
               Klikając "Rozpocznij", akceptujesz nasz Regulamin oraz Politykę Prywatności. Do rozpoczęcia okresu próbnego nie wymagamy podpięcia karty kredytowej.
             </p>
          )}
        </div>
      </div>
    </div>
  );
}
