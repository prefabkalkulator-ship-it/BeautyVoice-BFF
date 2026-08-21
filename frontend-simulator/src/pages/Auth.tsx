import { useState } from 'react';
import { Bot, Phone, Building2, ArrowRight, Loader2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Auth() {
  const navigate = useNavigate();
  
  const [salonName, setSalonName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Symulacja rejestracji konta i automatycznego logowania
      // W przyszłości Supabase OTP via SMS
      setTimeout(() => {
        setLoading(false);
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
          <span className="font-serif text-3xl text-surface-900 flex items-baseline">
            E<span className="text-[0.65em]">asy</span>V<span className="text-[0.65em]">oice</span>A<span className="text-[0.65em]">ssistant</span>
          </span>
        </Link>
        <h2 className="mt-8 text-center text-3xl font-serif text-surface-900 tracking-tight">
          Stwórz darmowe konto
        </h2>
        <p className="mt-2 text-center text-sm text-surface-500">
          Uzupełnij dwa pola i zacznij testować wirtualną asystentkę od zaraz.
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
              <label className="block text-sm font-medium text-surface-700">Nazwa salonu</label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  required
                  value={salonName}
                  onChange={(e) => setSalonName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-colors bg-white/50 focus:bg-white"
                  placeholder="Studio Urody EVA"
                />
              </div>
            </div>

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

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-surface-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-surface-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  Rozpocznij 7-dniowy okres próbny
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          
           <p className="mt-6 text-center text-xs text-surface-400">
             Klikając "Rozpocznij", akceptujesz nasz Regulamin oraz Politykę Prywatności. Do rozpoczęcia okresu próbnego nie wymagamy podpięcia karty kredytowej.
           </p>
        </div>
      </div>
    </div>
  );
}
