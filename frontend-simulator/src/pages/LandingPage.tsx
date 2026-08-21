import { Link } from 'react-router-dom';
import { Bot, Calendar, Clock, Star, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-50 selection:bg-gold-200 selection:text-gold-900 font-sans flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-surface-200/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-100 text-gold-600 flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <span className="font-serif text-2xl text-surface-900 flex items-baseline">
              E<span className="text-[0.65em]">asy</span>V<span className="text-[0.65em]">oice</span>A<span className="text-[0.65em]">ssistant</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors">Zaloguj się</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold-50 border border-gold-100 text-gold-700 text-sm font-medium">
              <Star className="w-4 h-4" />
              <span>Twój salon otwarty 24/7</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-serif text-surface-900 tracking-tight leading-[1.1]">
              Twój wirtualny pracownik <span className="text-gold-500 italic block mt-2">odbiera telefony za Ciebie</span>
            </h1>
            <p className="mt-6 text-lg text-surface-600 leading-relaxed max-w-2xl mx-auto">
              Zatrudnij EVA – wirtualną asystentkę, która umawia wizyty, odpowiada na pytania i zarządza Twoim kalendarzem 24/7.
            </p>
            <div className="flex items-center justify-center gap-4 pt-6">
              <Link to="/register" className="bg-primary text-primary-foreground px-8 py-4 rounded-2xl text-lg font-medium hover:bg-surface-800 hover:text-white transition-all shadow-lg hover:shadow-xl flex items-center gap-2">
                Wypróbuj 7 dni za darmo
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-32">
            {[
              {
                icon: <Clock className="w-6 h-6" />,
                title: 'Dostępność 24/7',
                desc: 'Nigdy więcej nieodebranych połączeń. EVA pracuje poza godzinami otwarcia salonu i w weekendy.'
              },
              {
                icon: <Calendar className="w-6 h-6" />,
                title: 'Synchronizacja Kalendarza',
                desc: 'Integracja z kalendarzem na żywo. Wirtualna asystentka widzi wolne terminy i dopisuje do nich nowych klientów.'
              },
              {
                icon: <ShieldCheck className="w-6 h-6" />,
                title: 'Baza wiedzy salonu',
                desc: 'Zna cennik, usługi i zasady. Odpowie na każde standardowe pytanie klienta bez Twojego udziału.'
              }
            ].map((feat, i) => (
              <div key={i} className="glass-card p-8 rounded-3xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
                <div className="w-12 h-12 rounded-2xl bg-gold-50 text-gold-600 flex items-center justify-center mb-6">
                  {feat.icon}
                </div>
                <h3 className="text-xl font-serif text-surface-900 mb-3">{feat.title}</h3>
                <p className="text-surface-500 leading-relaxed">{feat.desc}</p>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-gold-100/40 to-transparent rounded-bl-full -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            ))}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-surface-200 bg-white py-12">
        <div className="max-w-7xl mx-auto px-6 text-center text-surface-500 text-sm">
          <div className="flex items-center justify-center gap-2 mb-4">
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
    </div>
  );
}
