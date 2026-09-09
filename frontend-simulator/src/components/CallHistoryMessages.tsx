import React, { useState, useEffect } from 'react';
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
  ShieldCheck
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
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'messages' | 'urgent'>('messages');
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleMarkProcessed = async (id: string) => {
    try {
      const res = await fetch(`/api/call-logs/${id}/processed`, { method: 'PUT' });
      if (res.ok) {
        setLogs(prev => prev.map(l => l.id === id ? { ...l, isProcessed: true } : l));
      }
    } catch (err) {
      console.error('Błąd oznaczania wiadomości:', err);
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Wiadomości & Rejestr Połączeń</h2>
            <PageHelpButton
              title="Wiadomości od Dzwoniących i Rejestr"
              description="Tutaj trafiają wszystkie połączenia obsłużone przez Twoją asystentkę AI. Jeśli dzwoniący zostawił wiadomość lub prosił o pilny kontakt, znajdziesz tu precyzyjne podsumowanie i bezpośredni przycisk do oddzwonienia."
              tips={[
                "Kliknij 'Oddzwoń', aby uruchomić bezpośrednie połączenie z numerem dzwoniącego.",
                "Gdy załatwisz sprawę, kliknij 'Oznacz jako załatwione', aby zdjąć powiadomienie z listy oczekujących.",
                "Wiadomości od kontaktów VIP są wyróżnione złotą gwiazdką i mają priorytetowy status."
              ]}
              guideSectionId="call-history"
            />
          </div>
          <p className="text-surface-500 mt-1">Przeglądaj nagrane wiadomości, syntezy rozmów i oddzwaniaj jednym kliknięciem.</p>
        </div>
      </div>

      {/* Zakładki filtrów */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-200 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('messages')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
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
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
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
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
              filter === 'all' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'bg-white text-surface-600 hover:bg-surface-100 border border-surface-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Wszystkie Połączenia ({logs.length})
          </button>
        </div>

        {/* Wyszukiwarka */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Szukaj rozmów..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-surface-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
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
                className={`bg-white rounded-2xl p-5 border shadow-sm transition flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                  !log.isProcessed && isUrgent
                    ? 'border-red-400 bg-red-50/10'
                    : !log.isProcessed && isVip
                    ? 'border-amber-300 bg-amber-50/10'
                    : 'border-surface-200/80 hover:border-surface-300'
                }`}
              >
                <div className="space-y-2 max-w-2xl">
                  {/* Nagłówek wpisu */}
                  <div className="flex flex-wrap items-center gap-2.5">
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
                        • Do kontaktu
                      </span>
                    )}
                  </div>

                  {/* Dzwoniący */}
                  <div className="flex items-center gap-2">
                    <strong className="text-base text-surface-900 font-serif">
                      {log.callerName || log.callerPhone}
                    </strong>
                    {log.callerName && log.callerPhone !== 'nieznany' && (
                      <span className="text-xs text-surface-500 font-mono">({log.callerPhone})</span>
                    )}
                    <span className="text-xs text-surface-400">• Czas: {log.durationSeconds}s</span>
                  </div>

                  {/* Treść wiadomości / podsumowanie */}
                  {log.summary && (
                    <div className="text-sm text-surface-700 leading-relaxed bg-surface-50 p-3 rounded-xl border border-surface-100">
                      {log.summary}
                    </div>
                  )}

                  {/* Działanie do podjęcia */}
                  {log.actionItems && (
                    <div className="text-xs text-primary font-semibold flex items-center gap-1.5">
                      <span>🎯 Zalecane działanie:</span>
                      <span>{log.actionItems}</span>
                    </div>
                  )}
                </div>

                {/* Akcje */}
                <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-surface-100">
                  {log.callerPhone && log.callerPhone !== 'nieznany' && (
                    <a
                      href={`tel:${log.callerPhone}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-surface-800 transition shadow-sm"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Oddzwoń
                    </a>
                  )}

                  {!log.isProcessed && (
                    <button
                      onClick={() => handleMarkProcessed(log.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium rounded-xl text-xs hover:bg-emerald-100 transition"
                      title="Oznacz jako załatwione"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Załatwione
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(log.id)}
                    className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                    title="Usuń wpis"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
