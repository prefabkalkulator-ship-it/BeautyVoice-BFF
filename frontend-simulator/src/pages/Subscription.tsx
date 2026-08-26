import React, { useState, useEffect } from 'react';
import { Check, CreditCard, Sparkles, PhoneCall, Loader2, ArrowRight } from 'lucide-react';

export default function Subscription() {
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [cardConnected, setCardConnected] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [provisionedNumber, setProvisionedNumber] = useState(null);
  const [subStatus, setSubStatus] = useState('none');
  const [subDetails, setSubDetails] = useState<any>(null);
  const [showWipeModal, setShowWipeModal] = useState(false);

  useEffect(() => {
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => {
        if (d && d.status && d.status !== 'none') {
          setSubStatus(d.status);
          setSubDetails(d);
        }
      });
  }, []);

  const handlePause = async () => {
    if (!confirm('Czy na pewno chcesz zawiesić subskrypcję?')) return;
    setIsLoading(true);
    const r = await fetch('/api/subscription/pause', { method: 'POST' });
    const d = await r.json();
    setSubStatus(d.status);
    setSubDetails(d);
    setIsLoading(false);
  };

  const handleResume = async () => {
    setIsLoading(true);
    const r = await fetch('/api/subscription/resume', { method: 'POST' });
    const d = await r.json();
    setSubStatus(d.status);
    setSubDetails(d);
    setIsLoading(false);
  };

  const handleCancel = async () => {
    setShowWipeModal(true);
  };

  const confirmWipe = async () => {
    setIsLoading(true);
    try {
      // First cancel the sub in stripe or locally
      await fetch('/api/subscription/cancel', { method: 'POST' });
      // Then wipe tenant
      await fetch('/api/tenant/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: localStorage.getItem('tenantId') || '00000000-0000-0000-0000-000000000000' })
      });
      localStorage.removeItem('tenantId');
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      setShowWipeModal(false);
    }
  };

  const handleChangePlan = async () => {
    setIsLoading(true);
    const r = await fetch('/api/subscription/change-plan', { method: 'POST' });
    const d = await r.json();
    setSubDetails(d);
    setIsLoading(false);
    alert('Plan został zmieniony pomyślnie!');
  };


  const handleSimulateCard = () => {
    setIsLoading(true);
    setTimeout(() => {
      setCardConnected(true);
      setStep(3);
      setIsLoading(false);
    }, 1000);
  };

  const handleProvision = async () => {
    if (!termsAccepted) {
      setError('Musisz zaakceptować regulamin, aby kontynuować.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const tenantId = '00000000-0000-0000-0000-000000000000';
      
      const resTerms = await fetch('/api/tenant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, termsAcceptedAt: new Date().toISOString() })
      });
      if (!resTerms.ok) throw new Error('Błąd zapisu regulaminu');

      const resStripe = await fetch('/api/stripe/bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, planName: selectedPlan })
      });
      if (!resStripe.ok) throw new Error('Błąd płatności Stripe');

      const resProv = await fetch('/api/tenant/provision-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });
      const dataProv = await resProv.json();
      if (!resProv.ok) throw new Error(dataProv.error || 'Błąd generowania numeru');
      
      setProvisionedNumber(dataProv.number);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };


   if (subStatus !== 'none') {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-serif text-surface-900 mb-6">Zarządzanie Subskrypcją</h1>
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-surface-200">
          <div className="mb-6">
            <h2 className="text-xl font-medium text-surface-900">Aktualny plan: <span className="font-bold uppercase text-primary">{subDetails?.planName || 'Standard'}</span></h2>
            <p className="text-surface-600 mt-2">Status: <strong className="uppercase">{subStatus}</strong></p>
            <p className="text-surface-600 mt-2">Wykorzystane minuty: <strong>{subDetails?.minutesUsed || 0} / {subDetails?.minutesIncluded || 100}</strong></p>
            {subStatus === 'paused' && <p className="text-amber-600 mt-2">Zawieś do: {new Date(subDetails?.pausedUntil).toLocaleDateString()}</p>}
            {subStatus === 'canceled' && <p className="text-red-600 mt-2">Subskrypcja wygasa z końcem okresu.</p>}
          </div>

          <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-surface-100">
            {subStatus === 'active' && (
              <>
                <button onClick={handlePause} disabled={isLoading} className="px-6 py-2 bg-gold-100 text-gold-700 border border-gold-200 rounded-xl hover:bg-gold-200 transition disabled:opacity-50 font-medium">Zawieś na 30 dni</button>
                <button onClick={handleChangePlan} disabled={isLoading} className="px-6 py-2 bg-surface-900 text-white rounded-xl hover:bg-surface-800 transition disabled:opacity-50 font-medium">Zmień plan</button>
                <button onClick={handleCancel} disabled={isLoading} className="px-6 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 transition disabled:opacity-50 font-medium">Anuluj subskrypcję</button>
              </>
            )}
            {subStatus === 'paused' && (
              <button onClick={handleResume} disabled={isLoading} className="px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-surface-800 shadow-sm transition disabled:bg-surface-300 disabled:text-white disabled:opacity-100 font-medium">Wznów asystenta</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-serif text-surface-900">Aktywacja Konta</h1>
        <p className="text-surface-500 mt-2">Ukończ proces w 3 prostych krokach, aby uruchomić wirtualnego asystenta.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Lewy panel: Kroki */}
        <div className="w-full md:w-1/3 space-y-6">
          <div className={`p-5 rounded-2xl border transition-colors ${step >= 1 ? 'bg-white border-primary shadow-sm' : 'bg-surface-50 border-surface-200 opacity-60'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-surface-200 text-surface-500'}`}>1</div>
              <h3 className="font-semibold text-surface-900">Wybierz plan</h3>
            </div>
            <p className="text-sm text-surface-500 ml-11">Wybierz plan idealny dla Twojej firmy.</p>
          </div>

          <div className={`p-5 rounded-2xl border transition-colors ${step >= 2 ? 'bg-white border-primary shadow-sm' : 'bg-surface-50 border-surface-200 opacity-60'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-surface-200 text-surface-500'}`}>2</div>
              <h3 className="font-semibold text-surface-900">Podepnij kartę</h3>
            </div>
            <p className="text-sm text-surface-500 ml-11">Bezpieczna płatność obsługiwana przez Stripe.</p>
          </div>

          <div className={`p-5 rounded-2xl border transition-colors ${step >= 3 ? 'bg-white border-primary shadow-sm' : 'bg-surface-50 border-surface-200 opacity-60'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-surface-200 text-surface-500'}`}>3</div>
              <h3 className="font-semibold text-surface-900">Pobierz numer swojego asystenta</h3>
            </div>
            <p className="text-sm text-surface-500 ml-11">Podsumowanie i wygenerowanie numeru.</p>
          </div>
        </div>

        {/* Prawy panel: Zawartość kroku */}
        <div className="w-full md:w-2/3">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Standard */}
              <div 
                className={`bg-white rounded-3xl p-6 shadow-sm border-2 cursor-pointer transition-all hover:border-gold-300 ${selectedPlan === 'standard' ? 'border-primary ring-4 ring-primary/10' : 'border-surface-200'}`}
                onClick={() => setSelectedPlan('standard')}
              >
                <h4 className="text-lg font-semibold text-surface-900 mb-1">Standard</h4>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-surface-900">199 zł</span>
                  <span className="text-surface-500 text-sm">/mc</span>
                </div>
                <ul className="space-y-3 mb-8 text-sm">
                  <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> <span className="text-surface-700">100 darmowych minut</span></li>
                  <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> <span className="text-surface-700">1 techniczny numer GSM</span></li>
                  <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> <span className="text-surface-700">Wybór z 3 głosów</span></li>
                </ul>
                <button 
                  onClick={() => setStep(2)}
                  className={`w-full py-2.5 rounded-xl font-medium transition-colors ${selectedPlan === 'standard' ? 'bg-primary text-primary-foreground hover:bg-surface-800' : 'bg-surface-100 text-surface-900'}`}
                >
                  Wybierz Standard
                </button>
              </div>

              {/* Premium */}
              <div 
                className={`bg-surface-900 rounded-3xl p-6 shadow-xl border-2 cursor-pointer transition-all hover:border-gold-400 relative ${selectedPlan === 'premium' ? 'border-gold-500 ring-4 ring-gold-500/20' : 'border-surface-800'}`}
                onClick={() => setSelectedPlan('premium')}
              >
                <div className="absolute -top-3 right-4 bg-gradient-to-r from-gold-400 to-gold-500 text-surface-900 text-[10px] font-bold uppercase py-1 px-2 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Premium
                </div>
                <h4 className="text-lg font-semibold text-white mb-1">Premium</h4>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-white">399 zł</span>
                  <span className="text-surface-400 text-sm">/mc</span>
                </div>
                <ul className="space-y-3 mb-8 text-sm">
                  <li className="flex items-start gap-2"><Check className="w-4 h-4 text-gold-500 shrink-0 mt-0.5" /> <span className="text-surface-300">300 darmowych minut</span></li>
                  <li className="flex items-start gap-2"><Check className="w-4 h-4 text-gold-500 shrink-0 mt-0.5" /> <span className="text-surface-300">Centrala na 5 kanałów</span></li>
                  <li className="flex items-start gap-2"><Check className="w-4 h-4 text-gold-500 shrink-0 mt-0.5" /> <span className="text-surface-300">Własny Sender ID SMS</span></li>
                </ul>
                <button 
                  onClick={() => setStep(2)}
                  className={`w-full py-2.5 rounded-xl font-medium transition-colors ${selectedPlan === 'premium' ? 'bg-gradient-to-r from-gold-400 to-gold-500 text-surface-900 hover:from-gold-300 hover:to-gold-400' : 'bg-surface-800 text-white'}`}
                >
                  Wybierz Premium
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-surface-200 text-center py-12">
              <CreditCard className="w-12 h-12 text-surface-300 mx-auto mb-4" />
              <h3 className="text-xl font-serif text-surface-900 mb-2">Podepnij kartę płatniczą</h3>
              <p className="text-surface-500 text-sm max-w-md mx-auto mb-8">Twoja karta nie zostanie obciążona przed akceptacją regulaminu w kolejnym kroku.</p>
              <button 
                onClick={handleSimulateCard}
                disabled={isLoading}
                className="bg-surface-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-surface-800 flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Symuluj podpięcie karty'}
              </button>
              <button onClick={() => setStep(1)} className="mt-6 text-sm text-surface-500 hover:text-surface-900">Wróć do wyboru planu</button>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-surface-200">
              <h3 className="text-xl font-serif text-surface-900 mb-6">Podsumowanie i Akceptacja</h3>
              
              <div className="bg-surface-50 rounded-xl p-4 border border-surface-100 mb-6 flex justify-between items-center">
                <div>
                  <div className="text-sm text-surface-500">Wybrany plan</div>
                  <div className="font-bold text-surface-900 capitalize">Plan {selectedPlan}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-surface-500">Kwota do zapłaty</div>
                  <div className="font-bold text-2xl text-primary">{selectedPlan === 'premium' ? '399 zł' : '199 zł'}</div>
                </div>
              </div>

              <label className="flex items-start gap-3 mb-8 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-surface-300 text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-sm text-surface-700 leading-relaxed group-hover:text-surface-900 transition-colors">
                  Akceptuję <a href="/terms" target="_blank" className="text-primary hover:underline font-medium" onClick={e => e.stopPropagation()}>Regulamin B2B oraz zawartą w nim Umowę Powierzenia Przetwarzania Danych</a> i upoważniam operatora do cyklicznego obciążania mojej karty.
                </span>
              </label>

              <div className="flex justify-between items-center pt-6 border-t border-surface-100">
                <button onClick={() => setStep(2)} className="text-sm text-surface-500 hover:text-surface-900 font-medium">Wróć</button>
                <button 
                  onClick={handleProvision}
                  disabled={!termsAccepted || isLoading}
                  className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-medium hover:bg-surface-800 hover:text-white disabled:opacity-50 flex items-center gap-2 shadow-lg"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Opłać i wygeneruj numer'}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-8 shadow-sm border border-green-100 text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-green-500/30">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-serif text-green-900 mb-2">Subskrypcja aktywna!</h3>
              <p className="text-green-700 mb-8">Twój wirtualny asystent otrzymał numer i jest gotowy do pracy.</p>

              <div className="bg-white rounded-2xl p-6 text-left shadow-sm border border-green-100">
                <p className="text-sm text-surface-600 mb-2">Twój dedykowany numer do przekierowań:</p>
                <div className="text-3xl font-mono font-bold text-surface-900 mb-6">{provisionedNumber}</div>
                
                <h4 className="font-medium text-surface-900 mb-3">Jak włączyć przekierowanie na telefonie firmowym?</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-surface-50 p-4 rounded-xl border border-surface-200">
                    <div className="text-xs font-semibold text-surface-500 mb-1">Natychmiast (Zawsze asystent)</div>
                    <div className="font-mono bg-surface-200 px-2 py-1 inline-block rounded text-sm text-surface-900 font-bold">*21*{provisionedNumber}#</div>
                  </div>
                  <div className="bg-surface-50 p-4 rounded-xl border border-surface-200">
                    <div className="text-xs font-semibold text-surface-500 mb-1">Po 15 sek. (Brak odbioru)</div>
                    <div className="font-mono bg-surface-200 px-2 py-1 inline-block rounded text-sm text-surface-900 font-bold">*61*{provisionedNumber}**15#</div>
                  </div>
                </div>
                <p className="text-xs text-surface-500 mt-4">Możesz wyłączyć przekierowanie kodem <code className="font-mono">#21#</code> lub <code className="font-mono">#61#</code> w dowolnym momencie.</p>
              </div>

              <a href="/dashboard/settings" className="mt-8 inline-flex items-center gap-2 text-green-700 hover:text-green-800 font-medium">
                Przejdź do ustawień asystenta <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
