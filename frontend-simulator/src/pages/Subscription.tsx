import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Check, 
  Sparkles, 
  PhoneCall, 
  Loader2, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  Send, 
  RefreshCw, 
  AlertCircle,
  Gift,
  Trash2,
  X,
  Lock,
  CheckCircle2,
  ShieldAlert,
  Crown,
  Briefcase,
  Building2,
  User
} from 'lucide-react';

export default function Subscription() {
  const [subStatus, setSubStatus] = useState('none');
  const [subDetails, setSubDetails] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Wybór typu asystenta pilotażowego: 'b2b' (Premium B2B) lub 'personal' (Osobisty Ekspert)
  const [selectedProfileType, setSelectedProfileType] = useState<'b2b' | 'personal'>('personal');

  // Pola formularza Beta
  const [salonName, setSalonName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState(localStorage.getItem('tenantPhone') || '');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');

  // Modale Zmiany Pakietu oraz Kasowania RODO
  const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [changePlanSuccess, setChangePlanSuccess] = useState('');
  const [selectedCheckoutType, setSelectedCheckoutType] = useState<'subscription' | 'prepaid_month'>('subscription');
  const [isProcessingStripe, setIsProcessingStripe] = useState(false);
  const [platformConfig, setPlatformConfig] = useState<any>({
    promoEnabled: true,
    promoMode: 'no_card',
    promoDays: 30,
    promoDefaultMinutes: 300,
    stripeConfigured: false
  });

  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipePin, setWipePin] = useState('');
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [isWiping, setIsWiping] = useState(false);
  const [wipeError, setWipeError] = useState('');

  const fetchStatus = async () => {
    try {
      const tid = localStorage.getItem('tenantId');
      const r = await fetch(`/api/beta/status${tid ? `?tenantId=${tid}` : ''}`);
      if (r.ok) {
        const d = await r.json();
        setTenant(d);
        if (d.id) {
          localStorage.setItem('tenantId', d.id);
        }
        if (d.name) setSalonName(d.name);
        if (d.betaContactPerson) setContactPerson(d.betaContactPerson);
        if (d.betaContactEmail || d.contactEmail) setContactEmail(d.betaContactEmail || d.contactEmail || '');
        if (d.phoneNumber) {
          setContactPhone(d.phoneNumber);
          localStorage.setItem('tenantPhone', d.phoneNumber);
        }
        if (d.businessProfile === 'personal') {
          setSelectedProfileType('personal');
        } else if (d.businessProfile) {
          setSelectedProfileType('b2b');
        }

        if (d.subscription && d.subscription.status && d.subscription.status !== 'none') {
          setSubStatus(d.subscription.status);
          setSubDetails(d.subscription);
        } else {
          setSubStatus('none');
        }
      }
    } catch (err) {
      console.error('Błąd pobierania statusu subskrypcji:', err);
    }
  };

  const fetchPlatformConfigPublic = async () => {
    try {
      const r = await fetch('/api/platform-config');
      if (r.ok) {
        const d = await r.json();
        setPlatformConfig(d);
      }
    } catch (_) {}
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
    fetchStatus();
    fetchPlatformConfigPublic();

    const params = new URLSearchParams(window.location.search);
    const successType = params.get('success');
    const canceled = params.get('canceled');
    if (successType === 'topup') {
      const mins = params.get('minutes') || '100';
      setSuccessMessage(`🎉 Płatność zakończona sukcesem! Do Twojego konta dopisano +${mins} nieprzepadających minut bonusowych.`);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (successType === 'prepaid') {
      setSuccessMessage('🎉 Opłacono 30 dni dostępu z góry (BLIK / Przelewy24)! Twój pakiet jest aktywny.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (successType === 'subscription') {
      setSuccessMessage('🎉 Subskrypcja została pomyślnie aktywowana w Stripe!');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (canceled === 'true') {
      setError('Płatność została anulowana przed ukończeniem.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (isChangePlanModalOpen || isWipeModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isChangePlanModalOpen, isWipeModalOpen]);

  const handleSwitchProfile = async (newProfile: 'solo' | 'personal') => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tenant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessProfile: newProfile })
      });
      if (res.ok) {
        setTenant((prev: any) => ({ ...prev, businessProfile: newProfile }));
        setSelectedProfileType(newProfile === 'personal' ? 'personal' : 'b2b');
        await fetchStatus();
      }
    } catch (e) {
      console.error('Błąd zmiany profilu:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyBeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactPhone.trim()) {
      setError('Podaj numer telefonu komórkowego.');
      return;
    }
    if (!contactEmail.trim()) {
      setError('Podaj adres e-mail.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const tid = localStorage.getItem('tenantId');
      const res = await fetch('/api/beta/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tid || tenant?.id,
          salonName: salonName.trim(),
          contactPerson: contactPerson.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
          notes: notes.trim(),
          businessProfile: selectedProfileType === 'personal' ? 'personal' : 'solo',
          requestedPlan: selectedProfileType === 'personal' ? 'personal_expert' : 'premium'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Wystąpił problem podczas wysyłania wniosku.');
      }

      setSuccessMessage(
        selectedProfileType === 'personal'
          ? 'Wniosek został pomyślnie wysłany! Administrator wkrótce skonfiguruje Twój dedykowany numer i aktywuje Pakiet Osobisty Ekspert.'
          : 'Wniosek został pomyślnie wysłany! Administrator wkrótce skonfiguruje Twój dedykowany numer i aktywuje pakiet pilotażowy B2B Premium.'
      );
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas wysyłania wniosku.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchStatus();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handlePause = async () => {
    if (!confirm('Czy na pewno chcesz zawiesić subskrypcję na 30 dni?')) return;
    setIsLoading(true);
    const tid = localStorage.getItem('tenantId');
    const r = await fetch('/api/subscription/pause', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tid })
    });
    const d = await r.json();
    if (d && d.status) {
      setSubStatus(d.status);
      setSubDetails(d);
    }
    setIsLoading(false);
  };

  const handleResume = async () => {
    setIsLoading(true);
    const tid = localStorage.getItem('tenantId');
    const r = await fetch('/api/subscription/resume', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tid })
    });
    const d = await r.json();
    if (d && d.status) {
      setSubStatus(d.status);
      setSubDetails(d);
    }
    setIsLoading(false);
  };

  const handleStripeCheckout = async (options: {
    planName?: string;
    checkoutType: 'subscription' | 'prepaid_month' | 'topup_minutes';
    topupPackageId?: 'topup_100' | 'topup_300';
  }) => {
    setIsProcessingStripe(true);
    setError('');
    try {
      const tid = tenant?.id || localStorage.getItem('tenantId') || '';
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tid,
          planName: options.planName || subDetails?.planName || 'standard',
          checkoutType: options.checkoutType,
          topupPackageId: options.topupPackageId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się zainicjować płatności Stripe.');
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message || 'Błąd połączenia z bramką płatności Stripe.');
    } finally {
      setIsProcessingStripe(false);
    }
  };

  const handleOpenStripePortal = async () => {
    setIsProcessingStripe(true);
    setError('');
    try {
      const tid = tenant?.id || localStorage.getItem('tenantId') || '';
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tid })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się otworzyć portalu rozliczeniowego Stripe.');
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message || 'Błąd otwierania portalu faktur Stripe.');
    } finally {
      setIsProcessingStripe(false);
    }
  };

  const handleChangePlan = async (targetPlan: 'personal' | 'personal_expert' | 'standard' | 'premium') => {
    setIsChangingPlan(true);
    setError('');
    setChangePlanSuccess('');
    try {
      // Jeśli użytkownik wybrał opcję "Opłać 1 miesiąc z góry (BLIK / Przelewy24)", od razu kierujemy do Stripe Checkout
      if (selectedCheckoutType === 'prepaid_month' && platformConfig?.stripeConfigured) {
        await handleStripeCheckout({ planName: targetPlan, checkoutType: 'prepaid_month' });
        return;
      }

      const tid = tenant?.id || localStorage.getItem('tenantId') || '';
      const phone = contactPhone || tenant?.phoneNumber || localStorage.getItem('tenantPhone') || '';
      const res = await fetch('/api/subscription/change-plan', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tid,
          'x-tenant-phone': phone
        },
        body: JSON.stringify({
          tenantId: tid,
          phoneNumber: phone,
          targetPlan
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się zmienić pakietu.');
      }
      if (data.requiresCheckout) {
        await handleStripeCheckout({ planName: targetPlan, checkoutType: selectedCheckoutType });
        return;
      }
      if (data.tenantId) {
        localStorage.setItem('tenantId', data.tenantId);
      }
      const planNamesDisplay: Record<string, string> = {
        personal: 'OSOBISTY',
        personal_expert: 'OSOBISTY EKSPERT',
        standard: 'STANDARD B2B',
        premium: 'PREMIUM B2B'
      };
      setChangePlanSuccess(`Pomyślnie zmieniono pakiet na: ${planNamesDisplay[targetPlan] || targetPlan.toUpperCase()}! Przeładowuję widok...`);
      setTimeout(() => {
        setIsChangePlanModalOpen(false);
        setChangePlanSuccess('');
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Błąd podczas zmiany pakietu');
    } finally {
      setIsChangingPlan(false);
    }
  };

  const handleConfirmWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsWiping(true);
    setWipeError('');
    try {
      const tid = tenant?.id || localStorage.getItem('tenantId') || '';
      const phone = contactPhone || tenant?.phoneNumber || localStorage.getItem('tenantPhone') || '';
      const res = await fetch('/api/tenant/wipe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': tid,
          'x-tenant-phone': phone
        },
        body: JSON.stringify({
          tenantId: tid,
          phoneNumber: phone,
          pinCode: wipePin.trim(),
          confirmText: wipeConfirmText.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się usunąć konta.');
      }
      localStorage.clear();
      alert('Wszystkie dane zostały trwale usunięte z bazy danych (art. 17 RODO). Subskrypcja została anulowana.');
      window.location.href = '/';
    } catch (err: any) {
      setWipeError(err.message || 'Błąd podczas usuwania konta.');
    } finally {
      setIsWiping(false);
    }
  };

  const renderModals = () => {
    const isPersonalExpert = subDetails?.planName === 'personal_expert';
    const isPersonal = (subDetails?.planName === 'personal' || tenant?.businessProfile === 'personal') && !isPersonalExpert;
    const isPremium = subDetails?.planName === 'premium' || subDetails?.planName === 'beta_pilot' || subDetails?.planName === 'pilot';
    const isStandard = !isPersonal && !isPersonalExpert && !isPremium;

    return (
      <>
        {/* --- MODAL: ZMIEŃ PAKIET --- */}
        {isChangePlanModalOpen && createPortal(
          <div 
            className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) setIsChangePlanModalOpen(false); }}
          >
            <div className="bg-white rounded-3xl max-w-6xl w-full p-5 sm:p-8 shadow-2xl border border-surface-200 relative my-3 sm:my-8 animate-in fade-in zoom-in-95 duration-150">
              <button 
                type="button"
                onClick={() => setIsChangePlanModalOpen(false)}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 text-surface-400 hover:text-surface-600 p-2 rounded-full hover:bg-surface-100 transition"
                aria-label="Zamknij"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6 pr-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Wybierz plan dla siebie lub firmy
                </div>
                <h3 className="text-xl sm:text-2xl font-serif text-surface-900">Zmień pakiet lub przedłuż subskrypcję</h3>
                <p className="text-xs sm:text-sm text-surface-600 mt-1">
                  Możesz w dowolnym momencie zmienić plan lub opłacić dostęp. Przejście na pakiet osobisty automatycznie dostosuje interfejs asystenta (Executive / VIP / Kalendarz roczny / Zasięg działania).
                </p>

                {/* Wybór metody płatności pod Polskę */}
                <div className="mt-4 p-3 bg-surface-50 border border-surface-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-bold text-surface-700">
                    💳 Preferowany sposób rozliczenia (Stripe Polska):
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCheckoutType('subscription')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
                        selectedCheckoutType === 'subscription'
                          ? 'bg-surface-900 text-white border-surface-900 shadow-xs'
                          : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-100'
                      }`}
                    >
                      🔄 Subskrypcja miesięczna (Apple Pay / Google Pay / Karta)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCheckoutType('prepaid_month')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
                        selectedCheckoutType === 'prepaid_month'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-100'
                      }`}
                    >
                      📱 Opłać 30 dni z góry bez karty (BLIK / Przelewy24)
                    </button>
                  </div>
                </div>
              </div>

              {changePlanSuccess && (
                <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{changePlanSuccess}</span>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. Pakiet Osobisty */}
                <div className={`rounded-2xl p-5 border-2 transition flex flex-col justify-between ${
                  isPersonal ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-600/20' : 'border-surface-200 hover:border-indigo-300 bg-white'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 text-[11px] font-bold rounded-lg uppercase tracking-wider">
                        Osobisty
                      </span>
                      {isPersonal && (
                        <span className="text-[11px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-200">
                          Aktualny
                        </span>
                      )}
                    </div>
                    <div className="mb-3">
                      <div className="text-2xl font-bold text-surface-900">149 zł<span className="text-xs text-surface-500 font-normal"> / mc netto</span></div>
                      <p className="text-xs text-surface-500 mt-0.5 font-medium">100 minut w cenie</p>
                    </div>
                    <p className="text-xs text-surface-600 mb-4 leading-relaxed">
                      Prywatna sekretarka executive: dyskretne odbieranie, kontakty VIP, kalendarz prywatny.
                    </p>
                    <ul className="text-xs space-y-2 text-surface-700 border-t border-surface-100 pt-3">
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Dedykowany numer wirtualny</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Dwuetapowe inteligentne powitanie</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Rozpoznawanie VIP (Rodzina, Klient)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Autoryzacja kodem PIN</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Poranny push i raport e-mail</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Czas skupienia (Deep Work)</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleChangePlan('personal')}
                    disabled={isChangingPlan || isProcessingStripe || (isPersonal && selectedCheckoutType !== 'prepaid_month')}
                    className={`w-full mt-5 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isPersonal && selectedCheckoutType !== 'prepaid_month'
                        ? 'bg-surface-200 text-surface-500 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
                    }`}
                  >
                    {(isChangingPlan || isProcessingStripe) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isPersonal && selectedCheckoutType !== 'prepaid_month'
                      ? 'Twój obecny pakiet'
                      : selectedCheckoutType === 'prepaid_month'
                      ? 'Opłać 30 dni (BLIK / P24)'
                      : 'Wybierz Osobisty'}
                  </button>
                </div>

                {/* 2. Pakiet Osobisty Ekspert */}
                <div className={`rounded-2xl p-5 border-2 transition flex flex-col justify-between relative ${
                  isPersonalExpert ? 'border-purple-600 bg-purple-50/30 ring-2 ring-purple-600/20' : 'border-surface-200 hover:border-purple-300 bg-white'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-900 text-[11px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-purple-600" /> Ekspert
                      </span>
                      {isPersonalExpert && (
                        <span className="text-[11px] font-bold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">
                          Aktualny
                        </span>
                      )}
                    </div>
                    <div className="mb-3">
                      <div className="text-2xl font-bold text-surface-900">349 zł<span className="text-xs text-surface-500 font-normal"> / mc netto</span></div>
                      <p className="text-xs text-purple-700 mt-0.5 font-semibold">300 minut (0,50 zł / min)</p>
                    </div>
                    <p className="text-xs text-surface-600 mb-4 leading-relaxed">
                      Dla kancelarii i ekspertów: kwalifikacja spraw, filtr rejonu, SMS odrzucenia i doszkalanie.
                    </p>
                    <ul className="text-xs space-y-2 text-surface-700 border-t border-surface-100 pt-3">
                      <li className="flex items-start gap-2 font-semibold text-purple-950">
                        <Check className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <span>Wszystko z Osobistego + 300 min</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <span>Kwalifikacja Sprawy i Budżetu</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <span>Informowanie o Zasięgu Działania</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <span>1-kliknięcie SMS Odrzucenia</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <span>Moduł „Audyt Rozmów i FAQ”</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <span>Potwierdzenia spotkań (SMS & Telefon)</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleChangePlan('personal_expert')}
                    disabled={isChangingPlan || isProcessingStripe || (isPersonalExpert && selectedCheckoutType !== 'prepaid_month')}
                    className={`w-full mt-5 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isPersonalExpert && selectedCheckoutType !== 'prepaid_month'
                        ? 'bg-surface-200 text-surface-500 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-purple-600/20'
                    }`}
                  >
                    {(isChangingPlan || isProcessingStripe) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isPersonalExpert && selectedCheckoutType !== 'prepaid_month'
                      ? 'Twój obecny pakiet'
                      : selectedCheckoutType === 'prepaid_month'
                      ? 'Opłać 30 dni (BLIK / P24)'
                      : 'Wybierz Osobisty Ekspert'}
                  </button>
                </div>

                {/* 3. Pakiet Standard B2B */}
                <div className={`rounded-2xl p-5 border-2 transition flex flex-col justify-between ${
                  isStandard ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-surface-200 hover:border-surface-300 bg-white'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 bg-surface-100 text-surface-800 text-[11px] font-bold rounded-lg uppercase tracking-wider">
                        Standard B2B
                      </span>
                      {isStandard && (
                        <span className="text-[11px] font-bold text-surface-900 bg-white px-2 py-0.5 rounded border border-surface-300">
                          Aktualny
                        </span>
                      )}
                    </div>
                    <div className="mb-3">
                      <div className="text-2xl font-bold text-surface-900">199 zł<span className="text-xs text-surface-500 font-normal"> / mc netto</span></div>
                      <p className="text-xs text-surface-500 mt-0.5 font-medium">100 minut w cenie</p>
                    </div>
                    <p className="text-xs text-surface-600 mb-4 leading-relaxed">
                      Dla jednoosobowych gabinetów i salonów potrzebujących automatycznej recepcji.
                    </p>
                    <ul className="text-xs space-y-2 text-surface-700 border-t border-surface-100 pt-3">
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>100 darmowych minut co miesiąc</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>4 naturalne głosy AI (PL/EN)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>Baza Wiedzy AI ze zdjęć i PDF</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>Umawianie w kalendarzu</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>Potwierdzenia SMS po rezerwacji</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>Ścieżka SMS (Booksy/ZnanyLekarz)</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleChangePlan('standard')}
                    disabled={isChangingPlan || isProcessingStripe || (isStandard && selectedCheckoutType !== 'prepaid_month')}
                    className={`w-full mt-5 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isStandard && selectedCheckoutType !== 'prepaid_month'
                        ? 'bg-surface-200 text-surface-500 cursor-not-allowed' 
                        : 'bg-surface-900 hover:bg-surface-800 text-white shadow-md'
                    }`}
                  >
                    {(isChangingPlan || isProcessingStripe) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isStandard && selectedCheckoutType !== 'prepaid_month'
                      ? 'Twój obecny pakiet'
                      : selectedCheckoutType === 'prepaid_month'
                      ? 'Opłać 30 dni (BLIK / P24)'
                      : 'Wybierz Standard B2B'}
                  </button>
                </div>

                {/* 4. Pakiet Premium B2B */}
                <div className={`rounded-2xl p-5 border-2 transition flex flex-col justify-between ${
                  isPremium ? 'border-amber-500 bg-amber-50/30 ring-2 ring-amber-500/20' : 'border-surface-200 hover:border-amber-300 bg-white'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-900 text-[11px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                        <Crown className="w-3 h-3 text-amber-600" /> Premium B2B
                      </span>
                      {isPremium && (
                        <span className="text-[11px] font-bold text-amber-700 bg-white px-2 py-0.5 rounded border border-amber-300">
                          Aktualny
                        </span>
                      )}
                    </div>
                    <div className="mb-3">
                      <div className="text-2xl font-bold text-surface-900">399 zł<span className="text-xs text-surface-500 font-normal"> / mc netto</span></div>
                      <p className="text-xs text-amber-700 mt-0.5 font-semibold">300 minut w cenie (0,50 zł / min)</p>
                    </div>
                    <p className="text-xs text-surface-600 mb-4 leading-relaxed">
                      Dla klinik i salonów: Marketing AI, Last Minute, NPS, reaktywacja bazy 90+.
                    </p>
                    <ul className="text-xs space-y-2 text-surface-700 border-t border-surface-100 pt-3">
                      <li className="flex items-start gap-2 font-medium text-amber-950">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Wszystko ze Standard + 300 min</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Wypełnianie okienek (Last Minute)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Badanie satysfakcji (NPS)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Reaktywacja bazy 90+ dni</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Wielokanałowość – do 5 rozmów naraz</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Moduł „Audyt Rozmów i FAQ”</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleChangePlan('premium')}
                    disabled={isChangingPlan || isProcessingStripe || (isPremium && selectedCheckoutType !== 'prepaid_month')}
                    className={`w-full mt-5 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isPremium && selectedCheckoutType !== 'prepaid_month'
                        ? 'bg-surface-200 text-surface-500 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20'
                    }`}
                  >
                    {(isChangingPlan || isProcessingStripe) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isPremium && selectedCheckoutType !== 'prepaid_month'
                      ? 'Twój obecny pakiet'
                      : selectedCheckoutType === 'prepaid_month'
                      ? 'Opłać 30 dni (BLIK / P24)'
                      : 'Wybierz Premium B2B'}
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-surface-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsChangePlanModalOpen(false)}
                  className="px-5 py-2 text-surface-600 hover:text-surface-900 text-xs font-semibold rounded-xl border border-surface-200 hover:bg-surface-50 transition"
                >
                  Zamknij
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* --- MODAL: KASOWANIE KONTA / RODO (PRAWO DO BYCIA ZAPOMNIANYM) --- */}
        {isWipeModalOpen && createPortal(
          <div 
            className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) setIsWipeModalOpen(false); }}
          >
            <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-8 shadow-2xl border-2 border-red-200 relative my-3 sm:my-8 animate-in fade-in zoom-in-95 duration-150">
              <button 
                type="button"
                onClick={() => setIsWipeModalOpen(false)}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 text-surface-400 hover:text-surface-600 p-2 rounded-full hover:bg-surface-100 transition"
                aria-label="Zamknij"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-bold text-red-950">
                    Usunięcie konta i danych (RODO)
                  </h3>
                  <p className="text-xs text-red-700">
                    Art. 17 RODO — Prawo do bycia zapomnianym
                  </p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-800 leading-relaxed mb-6 space-y-2">
                <p className="font-semibold">
                  ⚠️ Ta operacja jest NIEODWRACALNA i natychmiastowo usuwa:
                </p>
                <ul className="list-disc list-inside space-y-1 text-red-700 pl-1">
                  <li>Twoje konto klienta oraz przypisany numer wirtualny</li>
                  <li>Wszystkie rezerwacje, historię połączeń i transkrypcje audio</li>
                  <li>Bazę klientów, kontakty VIP oraz rocznice / notatki</li>
                  <li>Konfigurację asystenta EVA i bazę wiedzy</li>
                  <li>Aktywną lub oczekującą subskrypcję</li>
                </ul>
              </div>

              {wipeError && (
                <div className="mb-4 p-3.5 bg-red-100 border border-red-300 text-red-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{wipeError}</span>
                </div>
              )}

              <form onSubmit={handleConfirmWipe} className="space-y-4">
                {tenant?.hasPin !== false ? (
                  <div>
                    <label className="block text-xs font-semibold text-surface-800 uppercase tracking-wider mb-2">
                      Wpisz swój 4-cyfrowy kod PIN konta, aby potwierdzić:
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="current-password"
                        required
                        maxLength={8}
                        value={wipePin}
                        onChange={e => setWipePin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full pl-10 pr-4 py-3 border-2 border-surface-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 text-sm font-mono tracking-widest transition"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-surface-800 uppercase tracking-wider mb-2">
                      Wpisz słowo <span className="font-mono text-red-600 font-bold">USUŃ</span>, aby potwierdzić:
                    </label>
                    <input 
                      type="text"
                      required
                      value={wipeConfirmText}
                      onChange={e => setWipeConfirmText(e.target.value)}
                      placeholder="USUŃ"
                      className="w-full px-4 py-3 border-2 border-surface-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 text-sm font-bold tracking-wider transition uppercase"
                    />
                  </div>
                )}

                <div className="pt-4 border-t border-surface-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsWipeModalOpen(false)}
                    disabled={isWiping}
                    className="px-5 py-2.5 text-surface-600 hover:text-surface-900 text-xs font-semibold rounded-xl border border-surface-200 hover:bg-surface-50 transition"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isWiping}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center gap-2 transition"
                  >
                    {isWiping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Trwale usuń wszystkie dane (RODO)
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  };

  // --- WIDOK 2: Wniosek oczekuje na weryfikację przez SuperAdmina ---
  if (tenant?.betaStatus === 'pending') {
    const isPersonalPending = tenant?.businessProfile === 'personal';

    return (
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-amber-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
          
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                Weryfikacja w toku
              </span>
              <h2 className="text-2xl font-serif text-surface-900 mt-1">
                {isPersonalPending ? 'Twój wniosek o Asystenta Osobistego jest przetwarzany' : 'Twój wniosek pilotażowy dla firmy jest przetwarzany'}
              </h2>
            </div>
          </div>

          <p className="text-surface-600 leading-relaxed mb-6">
            {isPersonalPending 
              ? 'Dziękujemy za zgłoszenie do pakietu Osobisty Ekspert asystenta EVA. Nasz zespół techniczny aktualnie konfiguruje dla Ciebie dedykowany numer wirtualny GSM do przekierowań (*21* i *61*).'
              : 'Dziękujemy za zgłoszenie do programu pilotażowego Premium asystenta EVA. Nasz zespół techniczny aktualnie konfiguruje dla Ciebie dedykowany numer wirtualny GSM.'}
          </p>

          {/* Baner motywacyjny: konfiguracja w krokach */}
          <div className="p-5 bg-gradient-to-r from-amber-500/10 via-gold-500/10 to-amber-500/10 border-2 border-gold-400/50 rounded-2xl mb-6 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-surface-900 text-sm mb-1">
                  💡 Nie trać czasu podczas oczekiwania na numer!
                </h4>
                <p className="text-xs text-surface-600 leading-relaxed mb-3">
                  {isPersonalPending ? (
                    <>Możesz już teraz w pełni przygotować asystenta osobistego w 6 prostych krokach. Sprawdź pasek <strong>„Kolejność wdrożenia asystenta EVA”</strong> widoczny u góry ekranu i skonfiguruj swój profil i BIO, bazę wiedzy (FAQ), kontakty VIP oraz ważne daty.</>
                  ) : (
                    <>Możesz już teraz w pełni przygotować asystenta EVA w 5 prostych krokach. Sprawdź pasek <strong>„Kolejność wdrożenia asystenta EVA”</strong> widoczny u góry ekranu i skonfiguruj profil firmy, usługi, godziny pracy oraz bazę wiedzy (FAQ).</>
                  )}
                </p>
                <a 
                  href="/dashboard/settings" 
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface-900 hover:bg-surface-800 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  {isPersonalPending ? 'Przejdź do konfiguracji asystenta osobistego' : 'Przejdź do konfiguracji firmy'} <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="bg-surface-50 rounded-2xl p-6 border border-surface-200 mb-6 space-y-3 text-sm">
            <h4 className="font-semibold text-surface-900 mb-2">Szczegóły Twojego zgłoszenia:</h4>
            
            <div className="flex flex-wrap items-center justify-between border-b border-surface-200/60 pb-2 gap-2">
              <span className="text-surface-500">Wybrany pakiet pilotażowy:</span>
              <div className="flex items-center gap-2">
                <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1 ${
                  isPersonalPending ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}>
                  {isPersonalPending ? (
                    <><Crown className="w-3.5 h-3.5 text-indigo-600" /> Pakiet Osobisty Ekspert</>
                  ) : (
                    <><Briefcase className="w-3.5 h-3.5 text-amber-600" /> Pakiet B2B Premium</>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleSwitchProfile(isPersonalPending ? 'solo' : 'personal')}
                  disabled={isLoading}
                  className="text-xs text-amber-700 hover:text-amber-900 underline font-semibold transition cursor-pointer"
                >
                  Zmień na {isPersonalPending ? '🏢 Pakiet Firmowy B2B' : '👤 Pakiet Osobisty Ekspert'}
                </button>
              </div>
            </div>

            <div className="flex justify-between border-b border-surface-200/60 pb-2">
              <span className="text-surface-500">{isPersonalPending ? 'Imię i Nazwisko:' : 'Firma:'}</span>
              <span className="font-medium text-surface-900">{tenant?.name || salonName}</span>
            </div>
            <div className="flex justify-between border-b border-surface-200/60 pb-2">
              <span className="text-surface-500">Telefon kontaktowy:</span>
              <span className="font-mono font-medium text-surface-900">{tenant?.phoneNumber || contactPhone || localStorage.getItem('tenantPhone') || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-surface-200/60 pb-2">
              <span className="text-surface-500">E-mail:</span>
              <span className="font-medium text-surface-900">{tenant?.betaContactEmail || tenant?.contactEmail || contactEmail || '—'}</span>
            </div>
            {tenant?.betaRequestedAt && (
              <div className="flex justify-between">
                <span className="text-surface-500">Data wysłania:</span>
                <span className="font-medium text-surface-900">{new Date(tenant.betaRequestedAt).toLocaleString('pl-PL')}</span>
              </div>
            )}
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 mb-6">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 leading-relaxed">
              <strong>Co nastąpi dalej?</strong> Po przydzieleniu numeru przez administratora otrzymasz 
              <strong> wiadomość SMS z powiadomieniem</strong> o aktywacji dedykowanego numeru EVA. 
              {isPersonalPending 
                ? ' Bezpłatny miesięczny pakiet Osobisty Ekspert z 300 darmowymi minutami aktywuje się automatycznie bez konieczności podawania karty. ' 
                : ' Bezpłatny miesięczny pakiet pilotażowy Premium z 300 darmowymi minutami aktywuje się automatycznie bez konieczności podawania karty. '}
              Do logowania używasz swojego numeru telefonu i kodu PIN ustalonego przy rejestracji.
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-surface-100">
            <span className="text-xs text-surface-500">Strona sprawdza status w tle</span>
            <button 
              onClick={handleManualRefresh} 
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface-900 text-white rounded-xl hover:bg-surface-800 transition text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Sprawdź status teraz
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-surface-100 flex justify-end">
            <button
              onClick={() => {
                setWipeError('');
                setWipePin('');
                setWipeConfirmText('');
                setIsWipeModalOpen(true);
              }}
              className="text-xs text-red-500 hover:text-red-700 underline transition inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Anuluj wniosek i trwale usuń dane z bazy (art. 17 RODO)
            </button>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // --- WIDOK 1: Subskrypcja aktywna / zawieszona Z PRZYDZIELONYM NUMEREM ---
  if (subStatus !== 'none' && tenant?.assignedPhoneNumber) {
    const isPilot = subDetails?.planName === 'beta_pilot' || subDetails?.planName === 'pilot';
    const isPersonalExpert = subDetails?.planName === 'personal_expert';
    const isPersonal = (subDetails?.planName === 'personal' || tenant?.businessProfile === 'personal') && !isPersonalExpert;

    const planLabel = isPilot 
      ? 'Pakiet Pilotażowy Premium (Miesiąc Gratis)' 
      : isPersonalExpert
      ? 'Pakiet Osobisty Ekspert (349 zł / mc)'
      : isPersonal 
      ? 'Pakiet Osobisty (149 zł / mc)' 
      : (subDetails?.planName === 'premium' ? 'Pakiet Premium B2B (399 zł / mc)' : (subDetails?.planName === 'standard' ? 'Pakiet Standard B2B (199 zł / mc)' : (subDetails?.planName ? subDetails.planName.toUpperCase() : 'STANDARD')));

    const includedMinutes = subDetails?.minutesIncluded || ((subDetails?.planName === 'personal' || subDetails?.planName === 'standard') ? 100 : 300);

    return (
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-serif text-surface-900">Zarządzanie Subskrypcją</h1>
          <button 
            onClick={handleManualRefresh} 
            disabled={isRefreshing}
            className="flex items-center gap-2 text-sm text-surface-600 hover:text-surface-900 bg-white px-3 py-1.5 rounded-lg border border-surface-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
        </div>

        {tenant?.isSuspended && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 rounded-2xl flex items-start gap-3">
            <span className="text-2xl">🚫</span>
            <div>
              <h3 className="font-bold text-red-800 text-sm">Blokada Administracyjna (SuperAdmin)</h3>
              <p className="text-xs text-red-600 mt-1">
                Twoje konto zostało zawieszone przez administratora platformy. Asystent głosowy i obsługa połączeń są wyłączone.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-surface-200">
          {successMessage && (
            <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-medium text-surface-900">
                Aktualny plan: <span className="font-bold text-primary">
                  {planLabel}
                </span>
              </h2>
              {isPilot && (
                <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3 h-3" /> Aktywny Pilotaż Premium
                </span>
              )}
              {isPersonalExpert && (
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Briefcase className="w-3 h-3" /> Pakiet Osobisty Ekspert
                </span>
              )}
              {isPersonal && !isPilot && (
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3 h-3" /> Pakiet Osobisty
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-surface-600">
              <div>
                Status: <strong className={`uppercase ${
                  subStatus === 'expired' ? 'text-red-600' :
                  subStatus === 'trialing' ? 'text-purple-700' :
                  subStatus === 'active' ? 'text-emerald-700' : 'text-surface-900'
                }`}>
                  {subStatus === 'trialing' ? 'DARMOWY OKRES / PILOTAŻ' : subStatus === 'expired' ? 'WYGASŁ (WYMAGA OPŁACENIA)' : subStatus}
                </strong>
              </div>

              {subDetails?.isLifetimeFree ? (
                <div className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                  ♾️ Dostęp bezterminowy VIP
                </div>
              ) : subDetails?.currentPeriodEnd ? (
                <div className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-xs font-semibold">
                  📅 Ważny do: <strong>{new Date(subDetails.currentPeriodEnd).toLocaleDateString('pl-PL')}</strong>
                  {' '}({Math.max(0, Math.ceil((new Date(subDetails.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} dni)
                </div>
              ) : null}
            </div>

            {/* DWIE PULE MINUT: MIESIĘCZNA + NIEPRZEPADAJĄCE MINUTY BONUSOWE */}
            <div className="grid sm:grid-cols-2 gap-4 mt-5">
              <div className="p-4 bg-surface-50 border border-surface-200 rounded-2xl">
                <div className="flex items-center justify-between text-xs font-semibold text-surface-600 uppercase tracking-wider mb-1">
                  <span>Minuty w pakiecie miesięcznym</span>
                  <span className="text-surface-900 font-bold">{subDetails?.minutesUsed || 0} / {includedMinutes} min</span>
                </div>
                <div className="w-full h-2.5 bg-surface-200 rounded-full overflow-hidden my-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.round(((subDetails?.minutesUsed || 0) / Math.max(1, includedMinutes)) * 100))}%` }}
                  />
                </div>
                <p className="text-[11px] text-surface-500">
                  Odnawiają się automatycznie z początkiem każdego nowego miesiąca rozliczeniowego.
                </p>
              </div>

              <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    🎁 Nieprzepadające minuty ekstra
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-bold">
                    Bezterminowe
                  </span>
                </div>
                <div className="text-2xl font-bold text-indigo-950 my-1">
                  {subDetails?.bonusMinutes || 0} min
                </div>
                <p className="text-[11px] text-indigo-700">
                  Minuty z doładowań i bonusów <strong>nigdy nie przepadają na koniec miesiąca</strong>. Są zużywane dopiero po wyczerpaniu pakietu miesięcznego.
                </p>
              </div>
            </div>

            {/* SEKCJA DOŁADOWAŃ NIEPRZEPADAJĄCYCH MINUT (BLIK / Przelewy24 / Apple Pay) */}
            <div className="mt-5 p-5 bg-gradient-to-r from-surface-50 via-indigo-50/30 to-surface-50 border border-surface-200 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-surface-900 flex items-center gap-1.5">
                    ⚡ Dokup nieprzepadające minuty głosowe (BLIK / Przelewy24 / Apple Pay)
                  </h4>
                  <p className="text-xs text-surface-600 mt-0.5">
                    Jednorazowa płatność w PLN (faktura VAT / NIP). Dokupione minuty przechodzą na kolejne miesiące bez terminu ważności.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={isProcessingStripe}
                    onClick={() => handleStripeCheckout({ checkoutType: 'topup_minutes', topupPackageId: 'topup_100' })}
                    className="px-4 py-2.5 bg-white hover:bg-indigo-50 text-indigo-900 border-2 border-indigo-200 hover:border-indigo-400 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>+100 minut</span>
                    <span className="text-indigo-600 font-extrabold">(79 zł)</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingStripe}
                    onClick={() => handleStripeCheckout({ checkoutType: 'topup_minutes', topupPackageId: 'topup_300' })}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>+300 minut</span>
                    <span className="text-indigo-100 font-extrabold">(149 zł • 0,50 zł/min)</span>
                  </button>
                </div>
              </div>
            </div>
            
            {tenant?.assignedPhoneNumber && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Twój dedykowany numer do przekierowań:</p>
                <div className="text-2xl font-mono font-bold text-emerald-950 mt-1">{tenant.assignedPhoneNumber}</div>
                
                <div className="mt-3 text-xs text-emerald-700 space-y-1">
                  <div>• Przekierowanie natychmiastowe: <code className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded font-bold">*21*{tenant.assignedPhoneNumber}#</code></div>
                  <div>• Przekierowanie gdy nie odbierasz (15s): <code className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded font-bold">*61*{tenant.assignedPhoneNumber}**15#</code></div>
                </div>
              </div>
            )}

            {subStatus === 'paused' && <p className="text-amber-600 mt-2">Zawieszono do: {new Date(subDetails?.pausedUntil).toLocaleDateString()}</p>}
            {subStatus === 'canceled' && <p className="text-red-600 mt-2">Subskrypcja wygasa z końcem okresu.</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-surface-100">
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => {
                  setError('');
                  setChangePlanSuccess('');
                  setSelectedCheckoutType('subscription');
                  setIsChangePlanModalOpen(true);
                }} 
                disabled={isLoading || isProcessingStripe} 
                className="px-5 py-2.5 bg-surface-900 hover:bg-surface-800 text-white rounded-xl shadow-sm transition disabled:opacity-50 font-medium text-sm flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                Zmień pakiet / Subskrypcja
              </button>

              <button
                type="button"
                disabled={isLoading || isProcessingStripe}
                onClick={() => handleStripeCheckout({
                  planName: subDetails?.planName || 'standard',
                  checkoutType: 'prepaid_month'
                })}
                className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl transition disabled:opacity-50 font-semibold text-xs flex items-center gap-1.5"
              >
                📱 Opłać 30 dni z góry (BLIK / Przelewy24)
              </button>

              {subDetails?.stripeCustomerId && (
                <button
                  type="button"
                  disabled={isLoading || isProcessingStripe}
                  onClick={handleOpenStripePortal}
                  className="px-4 py-2.5 bg-white hover:bg-surface-50 text-surface-700 border border-surface-200 rounded-xl transition disabled:opacity-50 font-semibold text-xs flex items-center gap-1.5"
                >
                  💳 Faktury VAT i zarządzanie kartą
                </button>
              )}

              {subStatus === 'active' && (
                <button onClick={handlePause} disabled={isLoading} className="px-5 py-2.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl hover:bg-amber-100 transition disabled:opacity-50 font-medium text-sm">
                  Zawieś asystenta na 30 dni
                </button>
              )}
              {subStatus === 'paused' && (
                <button onClick={handleResume} disabled={isLoading} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition disabled:opacity-50 font-medium text-sm">
                  Wznów asystenta
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setWipeError('');
                setWipePin('');
                setWipeConfirmText('');
                setIsWipeModalOpen(true);
              }}
              disabled={isLoading}
              className="px-4 py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl transition text-xs font-semibold flex items-center gap-1.5 ml-auto"
            >
              <Trash2 className="w-4 h-4" />
              Anuluj subskrypcję i usuń konto (RODO)
            </button>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // --- WIDOK 3: Formularz Zgłoszeniowy do Programu Pilotażowego Beta (3 miesiące gratis) ---
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Baner Pilotażowy adaptacyjny (Personal vs B2B) */}
      <div className={`mb-8 ${
        selectedProfileType === 'personal'
          ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800'
          : 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700'
      } text-white rounded-3xl p-8 shadow-xl relative overflow-hidden transition-all duration-300`}>
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-8 translate-y-8">
          <Gift className="w-64 h-64" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-200" /> 
            {selectedProfileType === 'personal' ? '👤 Zamknięty Program Pilotażowy Personal AI' : '🏢 Zamknięty Program Pilotażowy B2B'}
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-3">
            {selectedProfileType === 'personal' 
              ? 'Odbierz Miesięczny Pakiet Osobisty Ekspert Całkowicie Za Darmo' 
              : 'Odbierz Miesięczny Pakiet Pilotażowy Premium Całkowicie Za Darmo'}
          </h1>
          <p className="text-amber-100 text-sm sm:text-base leading-relaxed mb-3">
            {selectedProfileType === 'personal' ? (
              <>
                Dla pierwszych 5 użytkowników przygotowaliśmy bezpłatny miesięczny pakiet <strong>Osobisty Ekspert</strong>:
                <strong> 300 darmowych minut</strong>, dedykowany numer wirtualny GSM do przekierowań, ochronę VIP, strefy dostępności i pełną konfigurację bazy wiedzy. Bez podawania karty!
              </>
            ) : (
              <>
                Dla pierwszych 5 użytkowników przygotowaliśmy bezpłatny miesięczny pakiet <strong>Pilotażowy Premium B2B</strong>:
                <strong> 300 darmowych minut</strong>, dedykowany numer wirtualny, dostęp do modułu Marketing AI i pełną konfigurację bazy wiedzy. Bez podawania karty!
              </>
            )}
          </p>
          <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-sm px-3.5 py-1.5 rounded-xl text-xs text-amber-200 border border-white/20">
            <span>🎁</span>
            <span>Przetestuj pełnię możliwości EVA, podziel się swoją opinią i odbierz dodatkowe <strong>+100 darmowych minut</strong>!</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-sm flex items-center gap-2">
          <Check className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-surface-200">
        <div className="mb-6">
          <h2 className="text-xl font-serif text-surface-900 mb-1">Formularz zgłoszenia do programu pilotażowego</h2>
          <p className="text-sm text-surface-500">
            Wybierz przeznaczenie asystenta i wypełnij poniższe dane. Skontaktujemy się i natychmiast przydzielimy dedykowany numer wirtualny.
          </p>
        </div>

        <form onSubmit={handleApplyBeta} className="space-y-6">
          {/* Wybór typu asystenta: Personal vs B2B */}
          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2.5">
              Wybierz przeznaczenie asystenta EVA i bezpłatny pakiet pilotażowy:
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Opcja 1: Personal Expert */}
              <div
                onClick={() => setSelectedProfileType('personal')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative ${
                  selectedProfileType === 'personal'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-2 ring-indigo-500/20'
                    : 'border-surface-200 hover:border-surface-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      selectedProfileType === 'personal' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-surface-100 text-surface-600'
                    }`}>
                      <Crown className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-surface-900 text-sm">Pakiet Osobisty Ekspert</h4>
                      <span className="text-[11px] text-indigo-700 font-semibold">Dla osób prywatnych, ekspertów i menedżerów</span>
                    </div>
                  </div>
                  {selectedProfileType === 'personal' && (
                    <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-surface-600 leading-relaxed mt-1.5">
                  Osobista sekretarka AI: filtruje połączenia, dba o VIP-ów, chroni Twój czas wolny, pilnuje rocznic i organizuje Twój kalendarz.
                </p>
                <div className="mt-3 pt-2.5 border-t border-surface-200/60 flex items-center gap-2 text-[11px] text-indigo-900 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>300 darmowych minut + strefy VIP i kalendarz</span>
                </div>
              </div>

              {/* Opcja 2: B2B Premium */}
              <div
                onClick={() => setSelectedProfileType('b2b')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative ${
                  selectedProfileType === 'b2b'
                    ? 'border-amber-500 bg-amber-50/50 shadow-sm ring-2 ring-amber-400/20'
                    : 'border-surface-200 hover:border-surface-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      selectedProfileType === 'b2b' ? 'bg-amber-500 text-white shadow-xs' : 'bg-surface-100 text-surface-600'
                    }`}>
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-surface-900 text-sm">Pakiet B2B Premium</h4>
                      <span className="text-[11px] text-amber-700 font-semibold">Dla firm, salonów urody i gabinetów</span>
                    </div>
                  </div>
                  {selectedProfileType === 'b2b' && (
                    <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-surface-600 leading-relaxed mt-1.5">
                  Asystentka rejestratorka firmy: odbiera telefony od klientów, umawia wizyty, zarządza personelem, cennikiem i wysyła SMS.
                </p>
                <div className="mt-3 pt-2.5 border-t border-surface-200/60 flex items-center gap-2 text-[11px] text-amber-900 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>300 darmowych minut + moduł Marketing AI</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">
                {selectedProfileType === 'personal' ? 'Twoje Imię i Nazwisko *' : 'Nazwa Firmy / Salonu / Gabinetu *'}
              </label>
              <input 
                type="text" 
                required
                value={salonName}
                onChange={e => setSalonName(e.target.value)}
                placeholder={selectedProfileType === 'personal' ? 'np. Jan Kowalski' : 'np. Salon Urody Bella, Kancelaria Prawna'}
                className="w-full px-4 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">
                {selectedProfileType === 'personal' ? 'Twój zawód / specjalizacja (opcjonalnie)' : 'Osoba Kontaktowa *'}
              </label>
              <input 
                type="text"
                required={selectedProfileType === 'b2b'}
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder={selectedProfileType === 'personal' ? 'np. Menedżer, Programista, Adwokat, Lekarz' : 'np. Anna Kowalska'}
                className="w-full px-4 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm transition"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">
                Telefon komórkowy kontaktowy *
              </label>
              <input 
                type="tel"
                required
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="np. +48 500 100 200"
                className="w-full px-4 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm font-mono transition"
              />
              <p className="text-[11px] text-surface-500 mt-1">Na ten numer otrzymasz powiadomienie SMS o aktywacji dedykowanego numeru EVA.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">
                {selectedProfileType === 'personal' ? 'Twój prywatny adres E-mail *' : 'Adres E-mail firmy do kontaktu *'}
              </label>
              <input 
                type="email"
                required
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder={selectedProfileType === 'personal' ? 'twoj.email@poczta.pl' : 'kontakt@twojafirma.pl'}
                className="w-full px-4 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">
              {selectedProfileType === 'personal' ? 'Krótko o Twoich oczekiwaniach wobec asystenta (opcjonalnie)' : 'Krótko o Twojej firmie / oczekiwaniach (opcjonalnie)'}
            </label>
            <textarea 
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={selectedProfileType === 'personal' ? 'np. Kim jesteś, jakich połączeń się spodziewasz, jak asystent ma Cię przedstawiać i filtrować rozmowy...' : 'np. Czym zajmuje się firma, ile osób liczy zespół, w jakich sytuacjach EVA ma odbierać połączenia...'}
              className="w-full px-4 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm transition"
            />
          </div>

          {/* Podsumowanie korzyści */}
          <div className={`${
            selectedProfileType === 'personal' ? 'bg-indigo-50/60 border-indigo-200/80' : 'bg-amber-50/60 border-amber-200/80'
          } border rounded-2xl p-5`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${
              selectedProfileType === 'personal' ? 'text-indigo-900' : 'text-amber-900'
            }`}>
              Co wchodzi w Twój bezpłatny {selectedProfileType === 'personal' ? 'Pakiet Osobisty Ekspert' : 'Pakiet Premium B2B'}:
            </h4>
            <div className={`grid sm:grid-cols-4 gap-3 text-xs ${
              selectedProfileType === 'personal' ? 'text-indigo-800' : 'text-amber-800'
            }`}>
              <div className="flex items-center gap-2">
                <Check className={`w-4 h-4 ${selectedProfileType === 'personal' ? 'text-indigo-600' : 'text-amber-600'} shrink-0`} />
                <span>300 darmowych minut</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className={`w-4 h-4 ${selectedProfileType === 'personal' ? 'text-indigo-600' : 'text-amber-600'} shrink-0`} />
                <span>Własny numer wirtualny</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className={`w-4 h-4 ${selectedProfileType === 'personal' ? 'text-indigo-600' : 'text-amber-600'} shrink-0`} />
                <span>{selectedProfileType === 'personal' ? 'Strefy VIP i kalendarz' : 'Marketing AI (SMS/Głos)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className={`w-4 h-4 ${selectedProfileType === 'personal' ? 'text-indigo-600' : 'text-amber-600'} shrink-0`} />
                <span>Brak karty płatniczej</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-surface-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-surface-500 text-center sm:text-left">
              Przesłanie formularza aktywuje zgłoszenie do miesięcznego pakietu {selectedProfileType === 'personal' ? 'Osobisty Ekspert' : 'Pilotażowego Premium B2B'}.
            </p>
            <button 
              type="submit"
              disabled={isLoading}
              className={`w-full sm:w-auto px-8 py-3.5 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition ${
                selectedProfileType === 'personal'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-600/20'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20'
              }`}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {selectedProfileType === 'personal' ? 'Wyślij zgłoszenie do pakietu Osobisty Ekspert' : 'Wyślij zgłoszenie do pakietu B2B Premium'}
            </button>
          </div>
        </form>
      </div>

      {renderModals()}
    </div>
  );
}
