import { useState } from 'react';
import { Check, CreditCard, ShieldAlert, Sparkles, Zap, Loader2 } from 'lucide-react';

export default function Subscription() {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Tymczasowo używamy hardkodowanego tenantId
      const tenantId = '00000000-0000-0000-0000-000000000000';
      
      // Zamiast prawdziwego Stripe Checkout, symulujemy opłacenie subskrypcji (Mock Faza 8)
      const res = await fetch('/api/stripe/bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Wystąpił błąd podczas aktywacji planu PRO');
      
      // Sukces płatności – odśwież stronę, aby pobrać nowy plan z API
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Subskrypcja</h2>
        <p className="text-surface-500 mt-1">Zarządzaj swoim planem, limitami minut i płatnościami.</p>
        {error && <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Stan obecny / Okres próbny */}
        <div className="md:col-span-2 glass-card rounded-3xl p-8 border border-gold-200/50 bg-gradient-to-br from-white to-gold-50/30">
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-100 text-gold-700 text-xs font-semibold uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Aktywny okres próbny
              </div>
              <h3 className="text-2xl font-serif text-surface-900">Plan Freemium (Trial)</h3>
              <p className="text-surface-500 mt-1">Pozostało Ci 6 dni darmowego testowania wirtualnej asystentki.</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-gold-600 border border-gold-100">
              <Zap className="w-8 h-8" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-surface-600">Zużyte minuty w tym miesiącu</span>
              <span className="text-surface-900">12 / 100 min</span>
            </div>
            <div className="w-full bg-white rounded-full h-3 border border-surface-200 overflow-hidden">
              <div className="bg-gold-500 h-3 rounded-full" style={{ width: '12%' }}></div>
            </div>
            <p className="text-xs text-surface-400">Gdy przekroczysz darmowy limit 100 minut, konieczne będzie przejście na plan PRO.</p>
          </div>
        </div>

        {/* Metoda płatności */}
        <div className="glass-card rounded-3xl p-8 flex flex-col">
          <h3 className="text-lg font-serif text-surface-900 mb-2">Metoda płatności</h3>
          <p className="text-sm text-surface-500 mb-6">Brak podpiętej karty kredytowej.</p>
          
          <div className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-surface-200 rounded-2xl bg-surface-50/50 text-center mb-6">
            <CreditCard className="w-8 h-8 text-surface-300 mb-2" />
            <span className="text-sm font-medium text-surface-600">Podepnij kartę, by nie przerwać pracy EVA po okresie próbnym.</span>
          </div>

          <button 
            onClick={handleCheckout}
            disabled={isLoading}
            className="w-full bg-surface-900 text-white rounded-xl py-3 px-4 text-sm font-medium hover:bg-surface-800 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4 text-gold-400" />}
            Podepnij kartę (Stripe)
          </button>
        </div>
      </div>

      {/* Cennik */}
      <div className="pt-8">
        <div className="flex flex-col items-center mb-8">
          <h3 className="text-2xl font-serif text-surface-900 mb-6 text-center">Wybierz plan idealny dla Twojego salonu</h3>
          
          <div className="flex bg-surface-100 p-1 rounded-full">
            <button 
              onClick={() => setInterval('monthly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${interval === 'monthly' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-900'}`}
            >
              Rozliczenie miesięczne
            </button>
            <button 
              onClick={() => setInterval('yearly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${interval === 'yearly' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-900'}`}
            >
              Rozliczenie roczne <span className="bg-green-100 text-green-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Oszczędzasz 16%</span>
            </button>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Plan PRO */}
          <div className="glass-card rounded-3xl p-8 border-2 border-gold-500 shadow-xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 bg-gold-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-bl-xl">
              Rekomendowany
            </div>
            <h4 className="text-xl font-serif text-surface-900 mb-2 flex items-baseline">
              E<span className="text-[0.65em]">asy</span>V<span className="text-[0.65em]">oice</span>A<span className="text-[0.65em]">ssistant</span><span className="ml-1">PRO</span>
            </h4>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-surface-900">{interval === 'yearly' ? '1590 zł' : '159 zł'}</span>
              <span className="text-surface-500">{interval === 'yearly' ? '/ rok' : '/ miesiąc'}</span>
            </div>
            
            <ul className="space-y-4 mb-8 flex-1">
              {[
                'Nielimitowana baza wiedzy (FAQ)',
                'Automatyczna synchronizacja cenników',
                'Łatwe zarządzanie wizytami',
                'Niestandardowe wskazówki dla asystentki',
                'Priorytetowe wsparcie techniczne'
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-surface-600 text-sm">
                  <Check className="w-5 h-5 text-gold-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button 
              onClick={handleCheckout}
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground rounded-xl py-4 text-sm font-medium hover:bg-surface-800 hover:text-white transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {interval === 'yearly' ? 'Wybieram plan roczny' : 'Wybieram plan miesięczny'}
            </button>
          </div>
          
          {/* Plan Starter */}
          <div className="glass-card rounded-3xl p-8 border border-surface-200 flex flex-col">
            <h4 className="text-xl font-serif text-surface-900 mb-2">Plan Freemium</h4>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-surface-900">0 zł</span>
              <span className="text-surface-500">przez 7 dni</span>
            </div>
            
            <ul className="space-y-4 mb-8 flex-1">
              {[
                'Maksymalnie 2 darmowe analizy plików AI',
                'Ograniczona baza FAQ i usług',
                '100 minut rozmów w okresie próbnym',
                'Brak ukrytych opłat i zobowiązań na start',
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-surface-600 text-sm">
                  <Check className="w-5 h-5 text-surface-400 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button disabled className="w-full bg-surface-100 text-surface-500 rounded-xl py-4 text-sm font-medium border border-surface-200 cursor-not-allowed">
              Twój obecny plan
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
