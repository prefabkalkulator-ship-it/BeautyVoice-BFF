import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Gift, 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  AlertCircle, 
  Loader2, 
  BellRing,
  Sparkles,
  PartyPopper,
  Receipt
} from 'lucide-react';
import PageHelpButton from './common/PageHelpButton';

interface AnnualEvent {
  id: string;
  title: string;
  month: number;
  day: number;
  endMonth?: number | null;
  endDay?: number | null;
  category: string;
  reminderDaysAhead: number;
  createdAt: string;
}

const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

const CATEGORIES = [
  { id: 'vacation', label: 'Urlop / Dni Wolne', icon: CalendarIcon, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { id: 'birthday', label: 'Urodziny', icon: PartyPopper, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'anniversary', label: 'Rocznica', icon: Gift, color: 'text-pink-600 bg-pink-50 border-pink-200' },
  { id: 'tax', label: 'Podatki / ZUS / VAT', icon: Receipt, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'statutory', label: 'Święto / Termin Prawny', icon: CalendarIcon, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'custom', label: 'Inne', icon: Sparkles, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
];

export default function AnnualEvents() {
  const [events, setEvents] = useState<AnnualEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<AnnualEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingHolidays, setGeneratingHolidays] = useState(false);
  const [error, setError] = useState('');

  const generatePolishHolidays = async () => {
    const POLISH_HOLIDAYS = [
      { title: 'Nowy Rok', month: 1, day: 1, category: 'statutory', reminderDaysAhead: 1 },
      { title: 'Święto Trzech Króli', month: 1, day: 6, category: 'statutory', reminderDaysAhead: 1 },
      { title: 'Święto Pracy', month: 5, day: 1, category: 'statutory', reminderDaysAhead: 1 },
      { title: 'Święto Konstytucji 3 Maja', month: 5, day: 3, category: 'statutory', reminderDaysAhead: 1 },
      { title: 'Wniebowzięcie NMP / Wojska Polskiego', month: 8, day: 15, category: 'statutory', reminderDaysAhead: 1 },
      { title: 'Wszystkich Świętych', month: 11, day: 1, category: 'statutory', reminderDaysAhead: 1 },
      { title: 'Narodowe Święto Niepodległości', month: 11, day: 11, category: 'statutory', reminderDaysAhead: 1 },
      { title: 'Boże Narodzenie (I dzień)', month: 12, day: 25, category: 'statutory', reminderDaysAhead: 1 },
      { title: 'Boże Narodzenie (II dzień)', month: 12, day: 26, category: 'statutory', reminderDaysAhead: 1 }
    ];

    const toAdd = POLISH_HOLIDAYS.filter(h => 
      !events.some(e => e.month === h.month && e.day === h.day)
    );

    if (toAdd.length === 0) {
      alert('Wszystkie święta państwowe znajdują się już na liście.');
      return;
    }

    setGeneratingHolidays(true);
    try {
      for (const h of toAdd) {
        await fetch('/api/annual-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(h)
        });
      }
      await fetchEvents();
      alert(`Pomyślnie wygenerowano ${toAdd.length} świąt państwowych.`);
    } catch (err) {
      alert('Wystąpił problem podczas dodawania świąt.');
    } finally {
      setGeneratingHolidays(false);
    }
  };

  const [formData, setFormData] = useState({
    title: '',
    isRange: false,
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    endMonth: new Date().getMonth() + 1,
    endDay: new Date().getDate(),
    category: 'vacation',
    reminderDaysAhead: 1
  });

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/annual-events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Błąd pobierania wydarzeń:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const openAddModal = (presetCategory?: string) => {
    setCurrentEvent(null);
    setFormData({
      title: '',
      isRange: presetCategory === 'vacation',
      month: new Date().getMonth() + 1,
      day: new Date().getDate(),
      endMonth: new Date().getMonth() + 1,
      endDay: new Date().getDate(),
      category: presetCategory || 'vacation',
      reminderDaysAhead: 1
    });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (ev: AnnualEvent) => {
    setCurrentEvent(ev);
    const hasRange = Boolean(ev.endMonth && ev.endDay && !(ev.endMonth === ev.month && ev.endDay === ev.day));
    setFormData({
      title: ev.title,
      isRange: hasRange,
      month: ev.month,
      day: ev.day,
      endMonth: ev.endMonth || ev.month,
      endDay: ev.endDay || ev.day,
      category: ev.category,
      reminderDaysAhead: ev.reminderDaysAhead || 1
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Wpisz tytuł wydarzenia.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = currentEvent ? `/api/annual-events/${currentEvent.id}` : '/api/annual-events';
      const method = currentEvent ? 'PUT' : 'POST';

      const payload = {
        title: formData.title,
        month: formData.month,
        day: formData.day,
        endMonth: formData.isRange ? formData.endMonth : null,
        endDay: formData.isRange ? formData.endDay : null,
        category: formData.category,
        reminderDaysAhead: formData.reminderDaysAhead
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Błąd zapisu wydarzenia.');
      }

      setIsModalOpen(false);
      await fetchEvents();
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć wydarzenie: "${title}"?`)) return;

    try {
      const res = await fetch(`/api/annual-events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== id));
      }
    } catch (err) {
      alert('Błąd usuwania.');
    }
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentDay = new Date().getDate();

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 w-full max-w-full min-w-0">
      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Ważne Daty</h2>
            <PageHelpButton
              title="Cykliczne Rocznice i Ważne Daty"
              description="Zdefiniuj powtarzalne wydarzenia: urodziny bliskich i kluczowych klientów, rocznice, urlopy oraz cykliczne terminy podatkowe (ZUS, VAT). Asystent AI integruje je z widokami kalendarza i Porannym Raportem Push."
              tips={[
                "Baner całodzienny w Grafiku Dobowym: Ważne daty przypadające na dany dzień są widoczne na samej górze kalendarza w dedykowanej kolorystyce (🎂 Urodziny, 🏖️ Urlop, 🇵🇱 Święto, 💰 Podatki, 💍 Rocznica).",
                "Widok miesięczny: Kolorowe plakietki emoji w siatce dni oraz pełna interaktywna lista 'Ważne daty w tym miesiącu' pod kalendarzem.",
                "Przycisk 'Generuj Święta Państwowe': Jednym kliknięciem dodaje oficjalne polskie dni ustawowo wolne od pracy.",
                "Wyprzedzenie przypomnienia: Ustaw np. 2-3 dni przed urodzinami, aby otrzymać alert na zakup prezentu lub kwiatów w Porannym Raporcie Push."
              ]}
              guideSectionId="personal-important-dates"
            />
          </div>
          <p className="text-surface-500 mt-1">Nigdy nie zapomnij o urodzinach, rocznicach, kluczowych terminach, dniach wolnych i urlopach.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generatePolishHolidays}
            disabled={generatingHolidays}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-100 hover:bg-surface-200 text-surface-700 font-semibold rounded-xl border border-surface-200 shadow-xs transition text-sm disabled:opacity-50"
          >
            {generatingHolidays ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Sparkles className="w-4 h-4 text-primary" />}
            Generuj Święta Państwowe
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md hover:bg-surface-800 hover:text-white transition text-sm"
          >
            <Plus className="w-5 h-5" />
            Dodaj Ważną Datę
          </button>
        </div>
      </div>

      {/* Belka informacyjna */}
      <div className="bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-transparent border border-pink-300/40 rounded-2xl p-5 flex items-start gap-4">
        <div className="p-2.5 bg-pink-100 text-pink-700 rounded-xl shrink-0">
          <BellRing className="w-6 h-6 text-pink-600" />
        </div>
        <div>
          <h3 className="font-bold text-surface-900 text-sm">Automatyczna integracja z Porannym Raportem i Kalendarzem Asystenta</h3>
          <p className="text-xs text-surface-600 mt-1 leading-relaxed">
            Każdego ranka asystent sprawdza zbliżające się daty i informuje Cię o nich w powiadomieniu Push. W dniach świąt państwowych, urlopów i dodanych dni wolnych na kalendarz automatycznie nakładana jest <strong>reguła Niedzieli</strong> (klienci zewnętrzni słyszą, że odpoczywasz, a kontakty VIP i Rodzina kontaktują się według reguł strefy prywatnej).
          </p>
        </div>
      </div>

      {/* Lista Wydarzeń */}
      {loading ? (
        <div className="py-12 text-center text-surface-400 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm">Ładowanie wydarzeń...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-surface-200">
          <div className="w-16 h-16 rounded-2xl bg-surface-50 text-surface-400 flex items-center justify-center mx-auto mb-4">
            <Gift className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-serif font-bold text-surface-900">Brak zapisanych dat</h3>
          <p className="text-sm text-surface-500 max-w-md mx-auto mt-1 mb-6">
            Dodaj pierwsze urodziny, rocznicę lub termin podatkowy, aby asystent pamiętał o nich za Ciebie.
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-900 text-white text-sm font-semibold rounded-xl hover:bg-surface-800 transition"
          >
            <Plus className="w-4 h-4" />
            Dodaj pierwszą datę
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map(ev => {
            const isToday = ev.month === currentMonth && ev.day === currentDay;
            const categoryMeta = CATEGORIES.find(c => c.id === ev.category) || CATEGORIES[4];
            const Icon = categoryMeta.icon;

            return (
              <div 
                key={ev.id}
                className={`bg-white rounded-2xl p-5 border shadow-sm transition flex flex-col justify-between group ${
                  isToday ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20' : 'border-surface-200/80 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${categoryMeta.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-surface-900 text-base leading-snug">{ev.title}</h4>
                        <span className="text-xs text-surface-500">
                          {categoryMeta.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                      <button
                        onClick={() => openEditModal(ev)}
                        className="p-1.5 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg transition"
                        title="Edytuj"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(ev.id, ev.title)}
                        className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Usuń"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-surface-50 rounded-xl border border-surface-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-surface-400" />
                      <span className="font-bold text-surface-900 text-sm">
                        {ev.endMonth && ev.endDay && !(ev.endMonth === ev.month && ev.endDay === ev.day)
                          ? `${ev.day} ${MONTHS[ev.month - 1]} – ${ev.endDay} ${MONTHS[ev.endMonth - 1]}`
                          : `${ev.day} ${MONTHS[ev.month - 1]}`}
                      </span>
                    </div>

                    {isToday ? (
                      <span className="bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                        Dziś!
                      </span>
                    ) : (
                      <span className="text-[11px] text-surface-500">
                        Przypomnij {ev.reminderDaysAhead} {ev.reminderDaysAhead === 1 ? 'dzień' : 'dni'} wcześniej
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-4 border-t border-surface-100 flex items-center justify-between text-[11px] text-surface-400">
                  <span>Cykliczne co roku</span>
                  <span className="font-medium text-surface-600">Morning Briefing ✓</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-surface-900/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsModalOpen(false);
            }}
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-8 shadow-2xl border border-surface-200 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-bold text-surface-900">
                    {currentEvent ? 'Edytuj Datę' : 'Nowa Ważna Data'}
                  </h3>
                  <p className="text-xs text-surface-500">Powtarzalne wydarzenie w Twoim kalendarzu.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-surface-400 hover:text-surface-700 rounded-lg"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Przełącznik: Pojedyncza data vs Zakres dat */}
            <div className="flex items-center p-1 bg-surface-100 rounded-xl mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isRange: false })}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  !formData.isRange ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-500 hover:text-surface-700'
                }`}
              >
                Pojedyncza data
              </button>
              <button
                type="button"
                onClick={() => setFormData({ 
                  ...formData, 
                  isRange: true, 
                  category: 'vacation',
                  title: formData.title || 'Urlop wypoczynkowy'
                })}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  formData.isRange ? 'bg-white text-surface-900 shadow-xs' : 'text-surface-500 hover:text-surface-700'
                }`}
              >
                Zakres dat (Urlop / Dni wolne)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5">
                  Tytuł Wydarzenia *
                </label>
                <input 
                  type="text"
                  required
                  placeholder={formData.isRange ? "np. Urlop wypoczynkowy, Wyjazd służbowy" : "np. Urlop, Urodziny, Rocznica, Kluczowy termin"}
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              {!formData.isRange ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5">
                      Dzień *
                    </label>
                    <input 
                      type="number"
                      min="1"
                      max="31"
                      required
                      value={formData.day}
                      onChange={e => setFormData({ ...formData, day: parseInt(e.target.value, 10) })}
                      className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5">
                      Miesiąc *
                    </label>
                    <select
                      value={formData.month}
                      onChange={e => setFormData({ ...formData, month: parseInt(e.target.value, 10) })}
                      className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
                    >
                      {MONTHS.map((m, idx) => (
                        <option key={m} value={idx + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-surface-50 p-3.5 rounded-2xl border border-surface-200/80">
                  <div>
                    <span className="text-[11px] font-bold text-surface-700 uppercase tracking-wider block mb-1">
                      Data rozpoczęcia (Od):
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="number"
                        min="1"
                        max="31"
                        required
                        value={formData.day}
                        onChange={e => setFormData({ ...formData, day: parseInt(e.target.value, 10) })}
                        placeholder="Dzień"
                        className="px-3 py-2 border border-surface-200 rounded-lg text-sm bg-white"
                      />
                      <select
                        value={formData.month}
                        onChange={e => setFormData({ ...formData, month: parseInt(e.target.value, 10) })}
                        className="px-3 py-2 border border-surface-200 rounded-lg text-sm bg-white"
                      >
                        {MONTHS.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-surface-700 uppercase tracking-wider block mb-1">
                      Data zakończenia (Do):
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="number"
                        min="1"
                        max="31"
                        required
                        value={formData.endDay}
                        onChange={e => setFormData({ ...formData, endDay: parseInt(e.target.value, 10) })}
                        placeholder="Dzień"
                        className="px-3 py-2 border border-surface-200 rounded-lg text-sm bg-white"
                      />
                      <select
                        value={formData.endMonth}
                        onChange={e => setFormData({ ...formData, endMonth: parseInt(e.target.value, 10) })}
                        className="px-3 py-2 border border-surface-200 rounded-lg text-sm bg-white"
                      >
                        {MONTHS.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-[11px] text-rose-700 leading-tight pt-1">
                    🏖️ W tym okresie asystent automatycznie nałoży <strong>regułę Niedzieli</strong>: zewnętrzni klienci usłyszą, że odpoczywasz, a kontakty VIP i Rodzina kontaktują się według reguł strefy prywatnej.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5">
                  Kategoria
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5">
                  Przypomnij z wyprzedzeniem
                </label>
                <select
                  value={formData.reminderDaysAhead}
                  onChange={e => setFormData({ ...formData, reminderDaysAhead: parseInt(e.target.value, 10) })}
                  className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
                >
                  <option value={0}>Tylko w dniu wydarzenia</option>
                  <option value={1}>1 dzień wcześniej</option>
                  <option value={2}>2 dni wcześniej</option>
                  <option value={3}>3 dni wcześniej</option>
                  <option value={7}>Tydzień wcześniej</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-surface-600 hover:text-surface-900 font-medium"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-surface-800 hover:text-white disabled:opacity-50 transition text-sm shadow"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {currentEvent ? 'Zapisz Zmiany' : 'Dodaj Datę'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
