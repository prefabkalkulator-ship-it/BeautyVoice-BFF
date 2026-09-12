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
  Crown
} from 'lucide-react';

export default function Subscription() {
  const [subStatus, setSubStatus] = useState('none');
  const [subDetails, setSubDetails] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
    fetchStatus();
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
          notes: notes.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Wystąpił problem podczas wysyłania wniosku.');
      }

      setSuccessMessage('Wniosek został pomyślnie wysłany! Administrator wkrótce skonfiguruje Twój dedykowany numer i aktywuje pakiet pilotażowy Premium.');
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

  const handleChangePlan = async (targetPlan: 'personal' | 'standard' | 'premium') => {
    setIsChangingPlan(true);
    setError('');
    setChangePlanSuccess('');
    try {
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
      if (data.tenantId) {
        localStorage.setItem('tenantId', data.tenantId);
      }
      setChangePlanSuccess(`Pomyślnie zmieniono pakiet na: ${targetPlan === 'personal' ? 'OSOBISTY' : targetPlan.toUpperCase()}! Przeładowuję widok...`);
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
    const isPersonal = subDetails?.planName === 'personal' || tenant?.businessProfile === 'personal';
    const isPremium = subDetails?.planName === 'premium' || subDetails?.planName === 'beta_pilot' || subDetails?.planName === 'pilot';
    const isStandard = !isPersonal && !isPremium;

    return (
      <>
        {/* --- MODAL: ZMIEŃ PAKIET --- */}
        {isChangePlanModalOpen && createPortal(
          <div 
            className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) setIsChangePlanModalOpen(false); }}
          >
            <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-8 shadow-2xl border border-surface-200 relative my-3 sm:my-8 animate-in fade-in zoom-in-95 duration-150">
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
                <h3 className="text-xl sm:text-2xl font-serif text-surface-900">Zmień pakiet subskrypcji</h3>
                <p className="text-xs sm:text-sm text-surface-600 mt-1">
                  Możesz w dowolnym momencie zmienić plan. Przejście na pakiet osobisty automatycznie dostosuje interfejs asystenta (Executive / VIP / Kalendarz roczny).
                </p>
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

              <div className="grid md:grid-cols-3 gap-6">
                {/* 1. Pakiet Osobisty */}
                <div className={`rounded-2xl p-5 sm:p-6 border-2 transition flex flex-col justify-between ${
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
                    <div className="mb-4">
                      <div className="text-3xl font-bold text-surface-900">149 zł<span className="text-xs text-surface-500 font-normal"> / mc netto</span></div>
                      <p className="text-xs text-surface-500 mt-1 font-medium">100 minut w cenie (0,60 zł / min po wyczerpaniu)</p>
                    </div>
                    <p className="text-xs text-surface-600 mb-4 leading-relaxed">
                      Prywatna sekretarka executive: dyskretne odbieranie połączeń, kontakty VIP, kalendarz spraw prywatnych i tarcza anty-spam.
                    </p>
                    <ul className="text-xs space-y-2 text-surface-700 border-t border-surface-100 pt-4">
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Dedykowany numer wirtualny GSM</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Dwuetapowe inteligentne powitanie</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Rozpoznawanie VIP (Rodzina, Wspólnik)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Autoryzacja kodem PIN właściciela</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Baza wiedzy poufnej (kod PIN)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Poranny push i raporty e-mail</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Czas skupienia (Deep Work)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <span>Ważne daty (urodziny, polisy)</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleChangePlan('personal')}
                    disabled={isChangingPlan || isPersonal}
                    className={`w-full mt-6 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isPersonal 
                        ? 'bg-surface-200 text-surface-500 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
                    }`}
                  >
                    {isChangingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isPersonal ? 'Twój obecny pakiet' : 'Wybierz Pakiet Osobisty'}
                  </button>
                </div>

                {/* 2. Pakiet Standard B2B */}
                <div className={`rounded-2xl p-5 sm:p-6 border-2 transition flex flex-col justify-between ${
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
                    <div className="mb-4">
                      <div className="text-3xl font-bold text-surface-900">199 zł<span className="text-xs text-surface-500 font-normal"> / mc netto</span></div>
                      <p className="text-xs text-surface-500 mt-1 font-medium">100 minut w cenie (0,60 zł / min po wyczerpaniu)</p>
                    </div>
                    <p className="text-xs text-surface-600 mb-4 leading-relaxed">
                      Dla jednoosobowych gabinetów i salonów beauty potrzebujących automatycznej recepcji.
                    </p>
                    <ul className="text-xs space-y-2 text-surface-700 border-t border-surface-100 pt-4">
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>100 darmowych minut na rozmowy co miesiąc</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>1 dedykowany techniczny numer telefonu</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>4 naturalne głosy AI (2 żeńskie i 2 męskie)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>Obsługa ponad 140 języków (auto-detekcja)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>Baza Wiedzy AI ze zdjęć cenników i PDF</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>Grafiki pracowników i obsługa świąt / dni wolnych</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>Automatyczne umawianie terminów w kalendarzu</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>Potwierdzenia SMS do klientów po rezerwacji</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>Samodzielna konfiguracja w 10 minut</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleChangePlan('standard')}
                    disabled={isChangingPlan || isStandard}
                    className={`w-full mt-6 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isStandard 
                        ? 'bg-surface-200 text-surface-500 cursor-not-allowed' 
                        : 'bg-surface-900 hover:bg-surface-800 text-white shadow-md'
                    }`}
                  >
                    {isChangingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isStandard ? 'Twój obecny pakiet' : 'Wybierz Pakiet Standard B2B'}
                  </button>
                </div>

                {/* 3. Pakiet Premium B2B */}
                <div className={`rounded-2xl p-5 sm:p-6 border-2 transition flex flex-col justify-between ${
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
                    <div className="mb-4">
                      <div className="text-3xl font-bold text-surface-900">399 zł<span className="text-xs text-surface-500 font-normal"> / mc netto</span></div>
                      <p className="text-xs text-amber-700 mt-1 font-semibold">300 darmowych minut w cenie (0,50 zł / min po wyczerpaniu)</p>
                    </div>
                    <p className="text-xs text-surface-600 mb-4 leading-relaxed">
                      Dla rozwijających się zespołów, klinik i salonów z aktywnym modułem Marketing AI.
                    </p>
                    <ul className="text-xs space-y-2 text-surface-700 border-t border-surface-100 pt-4">
                      <li className="flex items-start gap-2 font-medium text-amber-950">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Wszystko z pakietu Standard B2B, oraz dodatkowo:</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>300 darmowych minut na rozmowy co miesiąc</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Wypełnianie okienek (Last Minute) – ratowanie terminów</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Badanie satysfakcji (NPS) – zbieranie opinii po wizycie</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Reaktywacja bazy 90+ dni – powrót dawnych klientów do firmy</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Telefoniczne potwierdzanie wizyt dzień wcześniej (zero „no-show”)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>Wielokanałowość – do 5 jednoczesnych rozmów naraz bez zajętości</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleChangePlan('premium')}
                    disabled={isChangingPlan || isPremium}
                    className={`w-full mt-6 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isPremium 
                        ? 'bg-surface-200 text-surface-500 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20'
                    }`}
                  >
                    {isChangingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isPremium ? 'Twój obecny pakiet' : 'Wybierz Pakiet Premium B2B'}
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
                        required
                        maxLength={6}
                        value={wipePin}
                        onChange={e => setWipePin(e.target.value)}
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

  // --- WIDOK 1: Subskrypcja aktywna / zawieszona ---
  if (subStatus !== 'none') {
    const isPilot = subDetails?.planName === 'beta_pilot' || subDetails?.planName === 'pilot';
    const isPersonal = subDetails?.planName === 'personal' || tenant?.businessProfile === 'personal';

    const planLabel = isPilot 
      ? 'Pakiet Pilotażowy Premium (Miesiąc Gratis)' 
      : (subDetails?.planName === 'personal' ? 'Pakiet Osobisty (149 zł / mc)' : (subDetails?.planName ? subDetails.planName.toUpperCase() : 'STANDARD'));

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
          <div className="mb-6">
            <div className="flex items-center gap-3">
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
              {isPersonal && !isPilot && (
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3 h-3" /> Pakiet Osobisty
                </span>
              )}
            </div>

            <p className="text-surface-600 mt-2">Status: <strong className="uppercase">{subStatus}</strong></p>
            <p className="text-surface-600 mt-2">Wykorzystane minuty: <strong>{subDetails?.minutesUsed || 0} / {subDetails?.minutesIncluded || (subDetails?.planName === 'personal' ? 100 : 300)}</strong></p>
            
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
                  setIsChangePlanModalOpen(true);
                }} 
                disabled={isLoading} 
                className="px-5 py-2.5 bg-surface-900 hover:bg-surface-800 text-white rounded-xl shadow-sm transition disabled:opacity-50 font-medium text-sm flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                Zmień pakiet
              </button>

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

  // --- WIDOK 2: Wniosek oczekuje na weryfikację przez SuperAdmina ---
  if (tenant?.betaStatus === 'pending') {
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
              <h2 className="text-2xl font-serif text-surface-900 mt-1">Twój wniosek pilotażowy jest przetwarzany</h2>
            </div>
          </div>

          <p className="text-surface-600 leading-relaxed mb-6">
            Dziękujemy za zgłoszenie do programu pilotażowego Premium asystenta EVA. 
            Nasz zespół techniczny aktualnie konfiguruje dla Ciebie dedykowany numer wirtualny GSM.
          </p>

          {/* Baner motywacyjny: konfiguracja w 5 krokach */}
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
                  Możesz już teraz w pełni przygotować asystenta EVA w 5 prostych krokach. Sprawdź pasek <strong>„Kolejność wdrożenia asystenta EVA”</strong> widoczny u góry ekranu i skonfiguruj profil firmy, usługi, godziny pracy oraz bazę wiedzy (FAQ).
                </p>
                <a 
                  href="/dashboard/settings" 
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface-900 hover:bg-surface-800 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  Przejdź do konfiguracji firmy <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="bg-surface-50 rounded-2xl p-6 border border-surface-200 mb-6 space-y-3 text-sm">
            <h4 className="font-semibold text-surface-900 mb-2">Szczegóły Twojego zgłoszenia:</h4>
            <div className="flex justify-between border-b border-surface-200/60 pb-2">
              <span className="text-surface-500">Firma:</span>
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
              Bezpłatny miesięczny pakiet pilotażowy Premium z 300 darmowymi minutami aktywuje się automatycznie bez konieczności podawania karty. Do logowania używasz swojego numeru telefonu i kodu PIN ustalonego przy rejestracji.
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

  // --- WIDOK 3: Formularz Zgłoszeniowy do Programu Pilotażowego Beta (3 miesiące gratis) ---
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Baner Pilotażowy */}
      <div className="mb-8 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-8 translate-y-8">
          <Gift className="w-64 h-64" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-200" /> Zamknięty Program Pilotażowy
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-3">
            Odbierz Miesięczny Pakiet Pilotażowy Premium Całkowicie Za Darmo
          </h1>
          <p className="text-amber-100 text-sm sm:text-base leading-relaxed mb-3">
            Dla pierwszych 5 użytkowników przygotowaliśmy bezpłatny miesięczny pakiet pilotażowy Premium:
            <strong> 300 darmowych minut</strong>, dedykowany numer wirtualny, dostęp do modułu Marketing AI i pełną konfigurację bazy wiedzy. Bez podawania karty!
          </p>
          <div className="inline-flex items-center gap-2 bg-amber-900/40 backdrop-blur-sm px-3.5 py-1.5 rounded-xl text-xs text-amber-200 border border-amber-400/30">
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
          <p className="text-sm text-surface-500">Wypełnij poniższe dane. Skontaktujemy się i natychmiast przydzielimy numer dla Twojej firmy.</p>
        </div>

        <form onSubmit={handleApplyBeta} className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">
                Nazwa Twojej Firmy *
              </label>
              <input 
                type="text"
                required
                value={salonName}
                onChange={e => setSalonName(e.target.value)}
                placeholder="np. Twoja Firma, Gabinet, Salon"
                className="w-full px-4 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">
                Osoba Kontaktowa *
              </label>
              <input 
                type="text"
                required
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder="np. Anna Kowalska"
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
                Adres E-mail do kontaktu *
              </label>
              <input 
                type="email"
                required
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="kontakt@twojafirma.pl"
                className="w-full px-4 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-2">
              Krótko o Twojej firmie / oczekiwaniach (opcjonalnie)
            </label>
            <textarea 
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="np. Czym zajmuje się firma, ile osób liczy zespół, w jakich sytuacjach EVA ma odbierać połączenia..."
              className="w-full px-4 py-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm transition"
            />
          </div>

          {/* Podsumowanie korzyści */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-3">Co wchodzi w Twój bezpłatny pakiet Premium:</h4>
            <div className="grid sm:grid-cols-4 gap-3 text-xs text-amber-800">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-600 shrink-0" />
                <span>300 darmowych minut</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Własny numer wirtualny</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Marketing AI (SMS/Głos)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Brak karty płatniczej</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-surface-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-surface-500 text-center sm:text-left">
              Przesłanie formularza aktywuje zgłoszenie do miesięcznego pakietu pilotażowego Premium.
            </p>
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 transition"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              Wyślij zgłoszenie do pakietu Premium
            </button>
          </div>
        </form>
      </div>

      {renderModals()}
    </div>
  );
}
