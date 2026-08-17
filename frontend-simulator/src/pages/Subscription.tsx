import { Check, CreditCard, ShieldAlert, Sparkles, Zap } from 'lucide-react';

export default function Subscription() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Subskrypcja</h2>
        <p className="text-surface-500 mt-1">Zarządzaj swoim planem, limitami minut i płatnościami.</p>
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
              <p className="text-surface-500 mt-1">Pozostało Ci 6 dni darmowego testowania asystenta.</p>
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
            <span className="text-sm font-medium text-surface-600">Podepnij kartę, by nie przerwać działania asystenta po okresie próbnym.</span>
          </div>

          <button className="w-full bg-surface-900 text-white rounded-xl py-3 px-4 text-sm font-medium hover:bg-surface-800 transition-colors shadow-sm flex items-center justify-center gap-2">
            <ShieldAlert className="w-4 h-4 text-gold-400" />
            Podepnij kartę (Stripe)
          </button>
        </div>
      </div>

      {/* Cennik */}
      <div className="pt-8">
        <h3 className="text-2xl font-serif text-surface-900 mb-6 text-center">Wybierz plan idealny dla Twojego salonu</h3>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Plan PRO */}
          <div className="glass-card rounded-3xl p-8 border-2 border-gold-500 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gold-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-bl-xl">
              Rekomendowany
            </div>
            <h4 className="text-xl font-serif text-surface-900 mb-2">Plan PRO</h4>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-surface-900">149 zł</span>
              <span className="text-surface-500">/ miesiąc</span>
            </div>
            
            <ul className="space-y-4 mb-8">
              {[
                'Nielimitowana ilość usług i bazy FAQ',
                '200 darmowych minut asystenta co miesiąc',
                '0,49 zł za każdą dodatkową minutę (Pay-as-you-go)',
                'Integracja z kalendarzem Google',
                'Priorytetowe wsparcie 24/7'
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-surface-600 text-sm">
                  <Check className="w-5 h-5 text-gold-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button className="w-full bg-primary text-primary-foreground rounded-xl py-4 text-sm font-medium hover:bg-surface-800 transition-all shadow-md hover:shadow-lg">
              Przejdź na PRO (Stripe Checkout)
            </button>
          </div>
          
          {/* Plan Starter */}
          <div className="glass-card rounded-3xl p-8 border border-surface-200">
            <h4 className="text-xl font-serif text-surface-900 mb-2">Plan Starter</h4>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-surface-900">0 zł</span>
              <span className="text-surface-500">przez 7 dni</span>
            </div>
            
            <ul className="space-y-4 mb-8">
              {[
                'Maksymalnie 5 usług',
                '100 próbnych minut na start',
                'Brak ukrytych opłat z góry',
                'Podstawowa integracja z kalendarzem',
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
