import { useState, useEffect } from 'react';
import { Calendar, Trash2, Plus, Sparkles } from 'lucide-react';

export default function TimeOff() {
  const [timeOffs, setTimeOffs] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ staffId: '', startDate: '', endDate: '', reason: '' });

  const loadData = async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        fetch('/api/timeoff'),
        fetch('/api/staff')
      ]);
      setTimeOffs(await tRes.json());
      setStaffList(await sRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Usunąć ten dzień wolny?')) return;
    await fetch('/api/timeoff/' + id, { method: 'DELETE' });
    loadData();
  };

  const handleSave = async () => {
    if (!form.startDate || !form.endDate) return alert('Wybierz daty');
    await fetch('/api/timeoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setIsModalOpen(false);
    loadData();
  };

  const generateHolidays = async () => {
    const year = new Date().getFullYear();
    const holidays = [
      { date: year + '-01-01', reason: 'Nowy Rok' },
      { date: year + '-01-06', reason: 'Trzech Króli' },
      { date: year + '-05-01', reason: 'Święto Pracy' },
      { date: year + '-05-03', reason: 'Święto Konstytucji 3 Maja' },
      { date: year + '-08-15', reason: 'Wniebowzięcie NMP' },
      { date: year + '-11-01', reason: 'Wszystkich Świętych' },
      { date: year + '-11-11', reason: 'Święto Niepodległości' },
      { date: year + '-12-25', reason: 'Boże Narodzenie' },
      { date: year + '-12-26', reason: 'Drugi dzień Świąt' }
    ];

    if (!confirm('Czy na pewno wygenerować oficjalne święta państwowe dla całego salonu na ten rok?')) return;
    
    setLoading(true);
    for (const h of holidays) {
      const exists = timeOffs.some((t:any) => t.reason === h.reason && t.startDate.startsWith(h.date));
      if (!exists) {
        await fetch('/api/timeoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffId: '', startDate: h.date + 'T00:00:00Z', endDate: h.date + 'T23:59:59Z', reason: h.reason })
        });
      }
    }
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif text-surface-900 mb-2">Dni Wolne i Urlopy</h1>
          <p className="text-surface-500">Zarządzaj dniami zamknięcia salonu oraz urlopami pracowników.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generateHolidays} className="bg-white border border-surface-200 text-surface-900 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-surface-50 transition-colors">
            <Sparkles className="w-4 h-4 text-gold-600" /> Święta
          </button>
          <button onClick={() => { setForm({ staffId: '', startDate: '', endDate: '', reason: '' }); setIsModalOpen(true); }} className="bg-surface-900 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-surface-800 transition-colors shadow-lg shadow-surface-900/20">
            <Plus className="w-4 h-4" /> Dodaj
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-surface-100 shadow-sm">
        {loading ? <div className="text-center py-8">Ładowanie...</div> : (
          <div className="space-y-3">
            {timeOffs.length === 0 ? <div className="text-center py-8 text-surface-400">Brak dni wolnych. Zapisane tu święta zablokują możliwość rezerwacji w kalendarzu.</div> : null}
            {timeOffs.map(t => (
              <div key={t.id} className="flex justify-between items-center p-4 bg-surface-50 rounded-xl border border-surface-100">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${!t.staffId ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-surface-900">{t.reason || 'Brak powodu'}</div>
                    <div className="text-xs text-surface-500">
                      {new Date(t.startDate).toLocaleDateString()} - {new Date(t.endDate).toLocaleDateString()} 
                      <span className="mx-2">•</span> 
                      <span className="font-medium text-surface-700">{!t.staffId ? 'CAŁY SALON' : (t.staff?.name || 'Pracownik')}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => handleDelete(t.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-5 h-5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/40 backdrop-blur-sm px-4">
          <div className="glass-card rounded-2xl p-6 relative w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-serif text-surface-900 mb-4">Dodaj Dzień Wolny</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Kogo dotyczy?</label>
                <select value={form.staffId} onChange={e => setForm({...form, staffId: e.target.value})} className="w-full bg-white border border-surface-200 rounded-xl px-3 py-2">
                  <option value="">Cały salon (zamknięte)</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Powód / Nazwa</label>
                <input type="text" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="w-full bg-white border border-surface-200 rounded-xl px-3 py-2" placeholder="np. Urlop wakacyjny" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Od</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="w-full bg-white border border-surface-200 rounded-xl px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Do</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="w-full bg-white border border-surface-200 rounded-xl px-3 py-2" />
                </div>
              </div>
              <div className="pt-4 flex gap-2">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2 bg-surface-100 text-surface-600 hover:bg-surface-200 rounded-xl transition-colors font-medium">Anuluj</button>
                <button onClick={handleSave} className="flex-1 py-2 bg-surface-200 text-surface-900 hover:bg-surface-800 hover:text-white rounded-xl transition-colors font-medium">Zapisz</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
