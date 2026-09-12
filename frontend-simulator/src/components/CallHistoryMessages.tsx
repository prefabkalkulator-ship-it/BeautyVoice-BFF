import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PhoneCall, 
  MessageSquare, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Phone, 
  Trash2, 
  Check, 
  Search, 
  Loader2,
  Star,
  User,
  ShieldCheck,
  Copy,
  Share2,
  UserPlus
} from 'lucide-react';
import PageHelpButton from './common/PageHelpButton';

interface CallLog {
  id: string;
  callerPhone: string;
  callerName?: string | null;
  callerRole: string;
  durationSeconds: number;
  status: string;
  summary?: string | null;
  actionItems?: string | null;
  isMessageLeft: boolean;
  urgency: string;
  pushSent: boolean;
  isProcessed: boolean;
  createdAt: string;
}

export default function CallHistoryMessages() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'messages' | 'urgent'>('messages');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = async (title: string, text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(text);
      alert('Skopiowano treść do schowka.');
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/call-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Błąd pobierania rejestru połączeń:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleToggleProcessed = async (id: string, currentProcessed: boolean) => {
    const targetStatus = !currentProcessed;
    setLogs(prev => prev.map(l => l.id === id ? { ...l, isProcessed: targetStatus } : l));
    try {
      await fetch(`/api/call-logs/${id}/processed`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isProcessed: targetStatus })
      });
    } catch (err) {
      console.error('Błąd zmiany statusu wiadomości:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Usunąć ten wpis z rejestru połączeń?')) return;
    try {
      const res = await fetch(`/api/call-logs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLogs(prev => prev.filter(l => l.id !== id));
      }
    } catch (err) {
      console.error('Błąd usuwania wpisu:', err);
    }
  };

  const filteredLogs = logs.filter(log => {
    // Filtr zakładek
    if (filter === 'messages' && !log.isMessageLeft && !log.summary) return false;
    if (filter === 'urgent' && log.urgency !== 'HIGH' && log.urgency !== 'CRITICAL') return false;

    // Filtr tekstowy
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.callerPhone.includes(q) ||
      (log.callerName && log.callerName.toLowerCase().includes(q)) ||
      (log.summary && log.summary.toLowerCase().includes(q)) ||
      (log.actionItems && log.actionItems.toLowerCase().includes(q))
    );
  });

  const messagesCount = logs.filter(l => (l.isMessageLeft || l.summary) && !l.isProcessed).length;
  const urgentCount = logs.filter(l => (l.urgency === 'HIGH' || l.urgency === 'CRITICAL') && !l.isProcessed).length;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 w-full max-w-full min-w-0">
      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Wiadomości & Rejestr Połączeń</h2>
            <PageHelpButton
              title="Wiadomości od Dzwoniących i Rejestr"
              description="Tutaj trafiają wszystkie połączenia obsłużone przez Twojego asystenta AI. Każda rozmowa zawiera precyzyjną, wielowątkową syntezę, analizę nastroju oraz bezpośrednie przyciski akcji."
              tips={[
                "Bogate podsumowania AI: Każda rozmowa posiada tag intencji ([💼 Oferta], [🚨 Reklamacja], [📅 Rezerwacja], [📝 Wiadomość]), sedno ustaleń, listę pytań pobocznych oraz obiektywną ocenę temperamentu i emocji rozmówcy (spokojny, zdenerwowany, wulgaryzmy).",
                "Wersja mobilna: Główny przycisk 'Oddzwoń' rozciąga się na pełną szerokość u góry karty dla błyskawicznego kontaktu kciukiem.",
                "Przyciski 'Kopiuj' i 'Udostępnij': Jednym kliknięciem skopiuj treść do schowka lub wyślij przez WhatsApp, SMS, Slack czy Notatki.",
                "Oznaczanie załatwionych: Po oddzwonieniu kliknij 'Załatwione', aby zdjąć wpis z listy spraw oczekujących.",
                "Wyróżnienie kontaktów z priorytetem: Rozmowy od kontaktów VIP i Rodziny są oznaczone złotą gwiazdką."
              ]}
              guideSectionId="personal-reports-share"
            />
          </div>
          <p className="text-surface-500 mt-1">Przeglądaj nagrane wiadomości, syntezy rozmów i oddzwaniaj jednym kliknięciem.</p>
        </div>
      </div>

      {/* Zakładki filtrów */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-200 pb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar sm:flex-wrap">
          <button
            onClick={() => setFilter('messages')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              filter === 'messages' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'bg-white text-surface-600 hover:bg-surface-100 border border-surface-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Wiadomości i Notatki
            {messagesCount > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                filter === 'messages' ? 'bg-white text-primary' : 'bg-primary text-white'
              }`}>
                {messagesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilter('urgent')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              filter === 'urgent' 
                ? 'bg-red-600 text-white shadow-sm' 
                : 'bg-white text-surface-600 hover:bg-surface-100 border border-surface-200'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            Pilne Sprawy
            {urgentCount > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                filter === 'urgent' ? 'bg-white text-red-600' : 'bg-red-600 text-white'
              }`}>
                {urgentCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              filter === 'all' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'bg-white text-surface-600 hover:bg-surface-100 border border-surface-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Wszystkie ({logs.length})
          </button>
        </div>

        {/* Wyszukiwarka */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Szukaj rozmów..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-surface-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
        </div>
      </div>

      {/* Lista Logów */}
      {loading ? (
        <div className="py-12 text-center text-surface-400 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm">Ładowanie historii połączeń...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-surface-200">
          <div className="w-16 h-16 rounded-2xl bg-surface-50 text-surface-400 flex items-center justify-center mx-auto mb-4">
            <PhoneCall className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-serif font-bold text-surface-900">Brak zarejestrowanych połączeń</h3>
          <p className="text-sm text-surface-500 max-w-md mx-auto mt-1">
            Gdy asystentka odbierze telefon od klienta lub osoby VIP, natychmiast zobaczysz tutaj podsumowanie sprawy.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map(log => {
            const isUrgent = log.urgency === 'HIGH' || log.urgency === 'CRITICAL';
            const isVip = log.callerRole === 'VIP';
            const isOwner = log.callerRole === 'OWNER';
            const dateStr = new Date(log.createdAt).toLocaleString('pl-PL', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div 
                key={log.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-sm transition flex flex-col md:flex-row md:items-start md:justify-between gap-4 w-full min-w-0 overflow-hidden ${
                  !log.isProcessed && isUrgent
                    ? 'border-red-400 bg-red-50/10'
                    : !log.isProcessed && isVip
                    ? 'border-amber-300 bg-amber-50/10'
                    : 'border-surface-200/80 hover:border-surface-300'
                }`}
              >
                <div className="space-y-2.5 min-w-0 flex-1 w-full">
                  {/* Nagłówek wpisu */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-surface-400">{dateStr}</span>

                    {isVip && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> VIP
                      </span>
                    )}

                    {isOwner && (
                      <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                        👑 Właściciel
                      </span>
                    )}

                    {isUrgent && (
                      <span className="bg-red-100 text-red-700 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <AlertCircle className="w-3 h-3 text-red-600" /> PILNE
                      </span>
                    )}

                    {log.isProcessed ? (
                      <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Załatwione
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-600 font-bold">
                        • Do załatwienia
                      </span>
                    )}
                  </div>

                  {/* Dzwoniący */}
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <strong className="text-base text-surface-900 font-serif truncate">
                      {log.callerName || log.callerPhone}
                    </strong>
                    {log.callerName && log.callerPhone !== 'nieznany' && (
                      <span className="text-xs text-surface-500 font-mono">({log.callerPhone})</span>
                    )}
                    <span className="text-xs text-surface-400">• Czas: {log.durationSeconds}s</span>
                  </div>

                  {/* Treść wiadomości / podsumowanie */}
                  {log.summary && (
                    <div className="space-y-2 min-w-0 w-full">
                      <div className="text-sm text-surface-700 leading-relaxed bg-surface-50 p-3 rounded-xl border border-surface-100 break-words whitespace-pre-wrap">
                        {log.summary}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopy(`${log.callerName ? log.callerName + ' (' + log.callerPhone + ')' : log.callerPhone}:\n${log.summary}\n${log.actionItems ? 'Zalecane działanie: ' + log.actionItems : ''}`, log.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-100 hover:bg-surface-200 text-surface-700 font-medium rounded-xl text-xs transition cursor-pointer"
                          title="Kopiuj treść wiadomości do schowka"
                        >
                          {copiedId === log.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === log.id ? 'Skopiowano!' : 'Kopiuj'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShare(`Wiadomość: ${log.callerName || log.callerPhone}`, `${log.callerName ? log.callerName + ' (' + log.callerPhone + ')' : log.callerPhone}:\n${log.summary}\n${log.actionItems ? 'Zalecane działanie: ' + log.actionItems : ''}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold-50 hover:bg-gold-100 text-gold-900 border border-gold-200/60 font-medium rounded-xl text-xs transition cursor-pointer"
                          title="Udostępnij przez WhatsApp, Wiadomości lub Notatki"
                        >
                          <Share2 className="w-3.5 h-3.5 text-gold-700" />
                          Udostępnij
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Działanie do podjęcia */}
                  {log.actionItems && (
                    <div className="text-xs text-primary font-semibold flex items-center gap-1.5 break-words">
                      <span>🎯 Zalecane działanie:</span>
                      <span>{log.actionItems}</span>
                    </div>
                  )}
                </div>

                {/* Akcje - pionowo z przyciskiem Oddzwoń na górze i resztą pod nim */}
                <div className="flex flex-col items-stretch md:items-end gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-surface-100 w-full md:w-auto">
                  {log.callerPhone && log.callerPhone !== 'nieznany' && (
                    <a
                      href={`tel:${log.callerPhone}`}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-surface-800 hover:text-white transition shadow-sm w-full md:w-auto text-center"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Oddzwoń ({log.callerPhone})
                    </a>
                  )}

                  {/* Pod przyciskiem Oddzwoń: Zapisz do VIP, Załatwione i Kosz */}
                  <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                    {log.callerPhone && log.callerPhone !== 'nieznany' && log.callerRole !== 'VIP' && (
                      <button
                        onClick={() => navigate('/dashboard/vip-contacts', {
                          state: {
                            openNewVip: true,
                            defaultPhone: log.callerPhone,
                            defaultName: log.callerName || ''
                          }
                        })}
                        className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 font-medium rounded-xl text-xs hover:bg-amber-100 transition whitespace-nowrap"
                        title="Zapisz do kontaktów VIP"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Zapisz VIP
                      </button>
                    )}

                    <button
                      onClick={() => handleToggleProcessed(log.id, log.isProcessed)}
                      className={`flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 font-medium rounded-xl text-xs transition cursor-pointer border whitespace-nowrap ${
                        log.isProcessed
                          ? 'bg-surface-100 text-surface-600 border-surface-200 hover:bg-surface-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      }`}
                      title={log.isProcessed ? 'Przywróć: Do załatwienia' : 'Oznacz jako załatwione'}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {log.isProcessed ? 'Do załatwienia' : 'Załatwione'}
                    </button>

                    <button
                      onClick={() => handleDelete(log.id)}
                      className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition border border-surface-200 md:border-transparent shrink-0"
                      title="Usuń wpis"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
