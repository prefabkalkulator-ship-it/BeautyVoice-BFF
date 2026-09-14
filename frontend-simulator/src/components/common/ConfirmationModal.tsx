import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Phone, MessageSquare, Info, Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPhone?: string;
  initialCustomerName?: string;
  initialAppointmentId?: string;
  initialDate?: string;
  initialTime?: string;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onSuccess,
  initialPhone,
  initialCustomerName,
  initialAppointmentId,
  initialDate,
  initialTime
}: ConfirmationModalProps) {
  const [targetScope, setTargetScope] = useState<string>('specific_customer');
  const [eventType, setEventType] = useState<'meeting' | 'visit'>('meeting');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [additionalNote, setAdditionalNote] = useState<string>('');
  const [confirmationMethod, setConfirmationMethod] = useState<'sms_two_way' | 'voice_call'>('sms_two_way');
  const [showInfoDetails, setShowInfoDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialPhone) {
        setTargetScope('specific_customer');
        setCustomerPhone(initialPhone);
      } else {
        setTargetScope('tomorrow_appointments');
        setCustomerPhone('');
      }
      setEventType('meeting');
      setAdditionalNote('');
      setConfirmationMethod('sms_two_way');
      setShowInfoDetails(false);
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsLoading(false);
    }
  }, [isOpen, initialPhone]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        toolName: 'schedule_confirmation_flow',
        args: {
          confirmation_method: confirmationMethod,
          target_scope: targetScope,
          event_type: eventType,
          eventType: eventType,
          additional_note: additionalNote.trim() || undefined
        }
      };

      if (targetScope === 'specific_customer') {
        payload.args.customerPhone = customerPhone.trim();
        if (initialAppointmentId) {
          payload.args.appointmentId = initialAppointmentId;
        }
      }

      const res = await fetch('/api/campaigns/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && !data.error) {
        setSuccessMsg(data.message || 'Zlecenie potwierdzenia zostało pomyślnie uruchomione!');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1200);
      } else {
        setErrorMsg(data.error || 'Wystąpił błąd podczas uruchamiania potwierdzenia.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Błąd połączenia z serwerem.');
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-surface-200/90 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek */}
        <div className="bg-gradient-to-r from-surface-900 via-surface-800 to-surface-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gold-500/20 text-gold-400 border border-gold-500/30 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-white leading-tight">
                Karta Akcji: Potwierdzenie Spotkania / Wizyty
              </h3>
              <p className="text-[11px] sm:text-xs text-surface-300">
                Weryfikacja obecności klienta przed spotkaniem lub wizytą
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-surface-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ciało formularza */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-surface-800">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 0. Wybór: Spotkanie vs Wizyta */}
          <div>
            <label className="block text-xs font-bold text-surface-700 uppercase tracking-wider mb-1.5">
              Rodzaj wydarzenia
            </label>
            <div className="grid grid-cols-2 gap-2 bg-surface-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setEventType('meeting')}
                className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  eventType === 'meeting'
                    ? 'bg-white text-surface-900 shadow-xs border border-surface-200'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                <span>🏢</span> Spotkanie (w biurze)
              </button>
              <button
                type="button"
                onClick={() => setEventType('visit')}
                className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  eventType === 'visit'
                    ? 'bg-white text-surface-900 shadow-xs border border-surface-200'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                <span>🚗</span> Wizyta (u klienta)
              </button>
            </div>
          </div>

          {/* 1. Zakres rezerwacji */}
          <div>
            <label className="block text-xs font-bold text-surface-700 uppercase tracking-wider mb-1.5">
              Zakres rezerwacji
            </label>
            <div className="space-y-2">
              <select
                value={targetScope}
                onChange={(e) => setTargetScope(e.target.value)}
                className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-surface-900 focus:outline-none focus:ring-2 focus:ring-gold-400 transition"
              >
                {initialPhone && (
                  <option value="specific_customer">
                    {initialPhone} {initialCustomerName ? `(${initialCustomerName})` : ''} {initialDate ? `• ${initialDate}` : ''} {initialTime ? `o ${initialTime}` : ''}
                  </option>
                )}
                {!initialPhone && (
                  <option value="specific_customer">Konkretny numer telefonu klienta</option>
                )}
                <option value="tomorrow_appointments">Wszystkie Spotkania / Wizyty jutro</option>
                <option value="all_unconfirmed">Wszystkie niepotwierdzone</option>
              </select>

              {/* Jeśli wybrano pojedynczy numer i nie było initialPhone, pozwól wpisać */}
              {targetScope === 'specific_customer' && !initialPhone && (
                <div className="mt-2">
                  <input
                    type="tel"
                    required
                    placeholder="Wpisz numer telefonu (np. +48 500 100 200)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-white border border-surface-200 rounded-xl px-3.5 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-gold-400 transition"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 2. Dodatkowa informacja */}
          <div>
            <label className="block text-xs font-bold text-surface-700 uppercase tracking-wider mb-1.5">
              Dodatkowa informacja dla klienta
            </label>
            <textarea
              rows={2}
              value={additionalNote}
              onChange={(e) => setAdditionalNote(e.target.value)}
              placeholder='na przykład: "Proszę nie zapomnieć dokumenty" albo "Proszę zapewnić dostęp"'
              className="w-full bg-surface-50 border border-surface-200 rounded-xl p-3 text-sm text-surface-900 placeholder:text-surface-400 placeholder:italic focus:outline-none focus:ring-2 focus:ring-gold-400 transition"
            />
          </div>

          {/* 3. Metoda potwierdzania */}
          <div>
            <label className="block text-xs font-bold text-surface-700 uppercase tracking-wider mb-1.5">
              Metoda potwierdzania
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmationMethod('sms_two_way')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
                  confirmationMethod === 'sms_two_way'
                    ? 'border-gold-500 bg-gold-50/60 ring-2 ring-gold-400/40 text-surface-900 font-semibold'
                    : 'border-surface-200 bg-white hover:bg-surface-50 text-surface-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  confirmationMethod === 'sms_two_way' ? 'border-gold-600 bg-gold-600' : 'border-surface-400'
                }`}>
                  {confirmationMethod === 'sms_two_way' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-gold-600" />
                    SMS Dwukierunkowy
                  </div>
                  <div className="text-[11px] text-surface-500 font-normal">Odpowiedź TAK lub NIE</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setConfirmationMethod('voice_call')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
                  confirmationMethod === 'voice_call'
                    ? 'border-gold-500 bg-gold-50/60 ring-2 ring-gold-400/40 text-surface-900 font-semibold'
                    : 'border-surface-200 bg-white hover:bg-surface-50 text-surface-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  confirmationMethod === 'voice_call' ? 'border-gold-600 bg-gold-600' : 'border-surface-400'
                }`}>
                  {confirmationMethod === 'voice_call' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gold-600" />
                    Telefon (Rozmowa z EVA)
                  </div>
                  <div className="text-[11px] text-surface-500 font-normal">Do 3 prób co 30 min</div>
                </div>
              </button>
            </div>
          </div>

          {/* 4. Edukacyjne Info (i) */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-950">
            <div 
              onClick={() => setShowInfoDetails(!showInfoDetails)}
              className="flex items-center justify-between cursor-pointer select-none font-semibold text-amber-900"
            >
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-[10px] font-bold">
                  i
                </div>
                <span>Dlaczego warto dzwonić z EVA zamiast samego SMS-a?</span>
              </div>
              <span className="text-amber-700 text-xs">{showInfoDetails ? 'Zwiń ▴' : 'Rozwiń ▾'}</span>
            </div>

            {showInfoDetails && (
              <div className="mt-2.5 pt-2.5 border-t border-amber-200/60 text-[12px] leading-relaxed space-y-1.5 text-amber-900">
                <p>
                  <strong>SMS Dwukierunkowy:</strong> Jest dyskretny i wygodny dla klienta, jednak klient może przeoczyć powiadomienie lub zapomnieć odpisać przed terminem.
                </p>
                <p>
                  <strong>Telefon z EVA:</strong> Jest znacznie szybszy i pewniejszy. Odbierając telefon, klient od razu potwierdza obecność lub zwalnia termin w rozmowie naturalnym językiem.
                </p>
                <p className="text-amber-800 font-medium">
                  💡 W trybie telefonicznym EVA podejmuje <strong>do 3 prób kontaktu w odstępach 30 minut</strong>. Jeśli klient nie odbierze po 3 próbach, system zarejestruje zdarzenie <em>Niepotwierdzono (3 próby)</em>.
                </p>
              </div>
            )}
          </div>

          {/* Przyciski akcji */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 border-t border-surface-100">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-surface-200 text-surface-600 hover:bg-surface-100 text-xs sm:text-sm font-semibold transition cursor-pointer"
            >
              Odrzuć
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-white font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uruchamianie...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Zatwierdź i Uruchom
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
