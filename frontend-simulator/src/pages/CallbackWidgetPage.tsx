import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  PhoneCall, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink,
  Code
} from 'lucide-react';

export default function CallbackWidgetPage() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId') || '';
  const theme = searchParams.get('theme') || 'light';
  const showEmbedInfo = searchParams.get('embed') === 'true';

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [callStatus, setCallStatus] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);

  const currentUrl = window.location.origin + '/widget/callback' + (tenantId ? `?tenantId=${tenantId}` : '');
  const iframeCode = `<iframe src="${currentUrl}" width="100%" height="340" frameborder="0" style="border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 420px; width: 100%; border: 1px solid #e5e7eb;"></iframe>`;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
        if (countdown > 20) {
          setCallStatus('Łączenie z cyfrową centralą...');
        } else if (countdown > 10) {
          setCallStatus('Asystentka EVA wybiera Twój numer...');
        } else {
          setCallStatus('Twój telefon za moment zadzwoni – odbierz połączenie!');
        }
      }, 1000);
    } else if (countdown === 0) {
      setCallStatus('Połączenie zainicjowane. Jeśli telefon nie zadzwonił, sprawdź poprawność numeru.');
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const clean = phone.replace(/[\s\-()]/g, '');
    if (!clean || clean.length < 9) {
      setError('Podaj poprawny 9-cyfrowy numer telefonu.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/callback/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: clean,
          name: name.trim() || undefined,
          tenantId: tenantId || undefined,
          source: 'standalone_widget'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się zamówić szybkiego kontaktu.');
      }

      setCountdown(30);
      setCallStatus('Inicjowanie bezpiecznego połączenia...');
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas zamawiania połączenia.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, type: 'link' | 'iframe') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2000);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-3 sm:p-6 ${
      theme === 'dark' ? 'bg-surface-950 text-white' : 'bg-surface-50 text-surface-900'
    }`}>
      {/* Karta Widżetu */}
      <div className={`w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-xl border transition-all ${
        theme === 'dark' 
          ? 'bg-surface-900 border-surface-800 shadow-black/40' 
          : 'bg-white border-surface-200/80 shadow-surface-200/50'
      }`}>
        {/* Nagłówek widżetu */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <PhoneCall className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                Live Callback 30s
              </span>
              <h2 className="text-lg font-serif font-bold leading-tight mt-0.5">
                Szybki Kontakt Telefoniczny
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCodeModal(!showCodeModal)}
            className="p-2 text-surface-400 hover:text-surface-600 rounded-xl hover:bg-surface-100 transition text-xs flex items-center gap-1 cursor-pointer"
            title="Pobierz kod do wklejenia na stronę WWW"
          >
            <Code className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-surface-600 leading-relaxed mb-6">
          Wpisz swój numer telefonu, a nasza inteligentna recepcja oddzwoni do Ciebie <strong>w ciągu 30 sekund</strong>, aby odpowiedzieć na pytania lub zarezerwować termin.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {countdown === null ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-surface-700 uppercase tracking-wider mb-1.5">
                Twój numer telefonu
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-surface-400 select-none">
                  +48
                </div>
                <input
                  type="tel"
                  required
                  placeholder="np. 500 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-surface-700 uppercase tracking-wider mb-1.5">
                Twoje imię (opcjonalnie)
              </label>
              <input
                type="text"
                placeholder="np. Anna"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Zamawianie połączenia...</span>
                </>
              ) : (
                <>
                  <PhoneCall className="w-4 h-4" />
                  <span>Zadzwoń do mnie teraz (30s)</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Ekran Odliczania na Żywo */
          <div className="text-center py-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              {/* Animowane kręgi fal radiowych */}
              <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-amber-400/30 animate-pulse" />
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 z-10">
                <span className="text-2xl font-bold font-mono">{countdown}s</span>
              </div>
            </div>

            <div>
              <h3 className="text-base font-serif font-bold text-surface-900">
                Oddzwaniamy na Twój numer
              </h3>
              <p className="text-xs text-amber-800 font-semibold mt-1">
                {callStatus}
              </p>
            </div>

            <div className="p-3 bg-amber-50/80 border border-amber-200/60 rounded-2xl text-xs text-amber-900 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Trzymaj telefon w pogotowiu!</span>
            </div>

            <button
              type="button"
              onClick={() => { setCountdown(null); setPhone(''); setName(''); }}
              className="text-xs text-surface-500 hover:text-surface-800 underline transition pt-2 cursor-pointer"
            >
              Zamów ponowne połączenie
            </button>
          </div>
        )}

        {/* Stopka zaufania i RODO */}
        <div className="mt-6 pt-4 border-t border-surface-100 flex items-center justify-between text-[11px] text-surface-400">
          <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zgodne z RODO i AI Act</span>
          </div>
          <span className="text-surface-400">Powered by EVA AI</span>
        </div>
      </div>

      {/* Modal / Sekcja Kodu Embed na Stronę WWW */}
      {(showCodeModal || showEmbedInfo) && (
        <div className="w-full max-w-md mt-4 p-5 bg-white rounded-3xl border border-surface-200 shadow-md text-xs space-y-3 animate-in fade-in slide-from-top-2">
          <div className="flex items-center justify-between">
            <h4 className="font-serif font-bold text-surface-900 flex items-center gap-1.5">
              <Code className="w-4 h-4 text-amber-600" />
              Umieść ten widżet na swojej stronie
            </h4>
            <button
              type="button"
              onClick={() => setShowCodeModal(false)}
              className="text-surface-400 hover:text-surface-700 text-xs font-semibold cursor-pointer"
            >
              Ukryj
            </button>
          </div>

          <p className="text-surface-500 leading-relaxed text-[11px]">
            Skopiuj poniższy kod i wklej w dowolnym miejscu na swojej stronie internetowej (WordPress, Wix, Webflow itp.) lub udostępnij link w bio:
          </p>

          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-surface-700 mb-1">
              <span>Bezpośredni link WWW:</span>
              <button
                type="button"
                onClick={() => handleCopy(currentUrl, 'link')}
                className="text-amber-700 hover:text-amber-800 flex items-center gap-1 font-bold cursor-pointer"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedLink ? 'Skopiowano!' : 'Kopiuj'}
              </button>
            </div>
            <div className="p-2 bg-surface-50 rounded-xl border border-surface-200 font-mono text-[10px] break-all select-all text-surface-700">
              {currentUrl}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-surface-700 mb-1">
              <span>Kod HTML Iframe do wklejenia:</span>
              <button
                type="button"
                onClick={() => handleCopy(iframeCode, 'iframe')}
                className="text-amber-700 hover:text-amber-800 flex items-center gap-1 font-bold cursor-pointer"
              >
                {copiedIframe ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedIframe ? 'Skopiowano!' : 'Kopiuj'}
              </button>
            </div>
            <textarea
              readOnly
              rows={3}
              value={iframeCode}
              className="w-full p-2 bg-surface-50 rounded-xl border border-surface-200 font-mono text-[10px] select-all text-surface-700 resize-none focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
