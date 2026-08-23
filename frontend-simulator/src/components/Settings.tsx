import { useEffect, useState } from 'react';
import { Save, Plus, X, User } from 'lucide-react';

const defaultSchedule = {
  "1": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "2": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "3": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "4": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "5": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "6": { "isWorking": false, "start": "10:00", "end": "14:00" },
  "0": { "isWorking": false, "start": "10:00", "end": "14:00" }
};

export default function Settings() {
  const [tenant, setTenant] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [businessProfile, setBusinessProfile] = useState('solo');
  const [bookingMode, setBookingMode] = useState('hourly');
  const [aiVoice, setAiVoice] = useState('Aoede');
  const [isSaving, setIsSaving] = useState(false);

  // Zmienne do modala pracownika
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<any>(null);
  const [staffForm, setStaffForm] = useState({ name: '', role: '', schedule: JSON.parse(JSON.stringify(defaultSchedule)), serviceIds: [] as string[] });

  const loadData = async (initialLoad = false) => {
    try {
      const [tRes, sRes, svcRes] = await Promise.all([
        fetch('/api/tenant'),
        fetch('/api/staff'),
        fetch('/api/services')
      ]);
      const tData = await tRes.json();
      const sData = await sRes.json();
      const svcData = await svcRes.json();
      
      setTenant(tData);
      if (initialLoad) {
        setBusinessProfile(tData.businessProfile || 'solo');
        setBookingMode(tData.bookingMode || 'hourly');
        setAiVoice(tData.aiVoice || 'Aoede');
      }
      setStaffList(sData);
      setServices(svcData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const saveTenantSettings = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/tenant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessProfile, aiVoice, bookingMode })
      });
      alert('Zapisano ustawienia firmy.');
    } catch (err) {
      alert('Błąd zapisu');
    }
    setIsSaving(false);
  };

  const openAddStaff = () => {
    setCurrentStaff(null);
    setStaffForm({ name: '', role: '', schedule: JSON.parse(JSON.stringify(defaultSchedule)), serviceIds: [] });
    setIsStaffModalOpen(true);
  };

  const openEditStaff = (staff: any) => {
    setCurrentStaff(staff);
    setStaffForm({ 
      name: staff.name, 
      role: staff.role || '', 
      schedule: staff.schedule || JSON.parse(JSON.stringify(defaultSchedule)),
      serviceIds: staff.services?.map((s: any) => s.serviceId) || [] 
    });
    setIsStaffModalOpen(true);
  };

  const saveStaff = async () => {
    try {
      const isNew = !currentStaff;
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/staff' : `/api/staff/${currentStaff.id}`;
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffForm)
      });
      setIsStaffModalOpen(false);
      loadData();
    } catch (err) {
      alert('Błąd zapisu pracownika');
    }
  };

  const deleteStaff = async (id: string) => {
    if(!confirm('Usunąć pracownika?')) return;
    try {
      await fetch(`/api/staff/${id}`, { method: 'DELETE' });
      loadData();
    } catch(err) {
      alert('Błąd');
    }
  };

  const toggleService = (serviceId: string) => {
    setStaffForm(prev => {
      const ids = prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : [...prev.serviceIds, serviceId];
      return { ...prev, serviceIds: ids };
    });
  };

  if (loading) return <div className="p-8">Ładowanie...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Ustawienia Firmy</h2>
        <p className="text-surface-500 mt-1">Konfiguruj profil działalności i zespół pracowników.</p>
      </div>

      <div className="glass-card rounded-2xl p-6 shadow-sm border border-surface-200/60">
        <h3 className="text-xl font-serif text-surface-900 mb-4">Profil Biznesowy</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { id: 'solo', title: 'Solo', desc: 'Jeden kalendarz główny, jeden usługodawca.' },
            { id: 'team', title: 'Zespół', desc: 'Wielu pracowników świadczących różne lub te same usługi.' },
            { id: 'facility', title: 'Obiekty', desc: 'Rezerwacja gabinetów lub zasobów bez konkretnego pracownika.' }
          ].map(opt => (
            <div 
              key={opt.id}
              onClick={() => setBusinessProfile(opt.id)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${businessProfile === opt.id ? 'border-primary bg-gold-50/30' : 'border-surface-200 hover:border-gold-300'}`}
            >
              <div className="font-medium text-surface-900">{opt.title}</div>
              <div className="text-sm text-surface-500 mt-1">{opt.desc}</div>
            </div>
          ))}
        </div>
        <div className="mb-6">
          <h4 className="font-medium text-surface-900 mb-3">Wybór głosu Asystenta AI</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'Aoede', title: 'EVA - Głos Żeński 1', desc: 'Spokojny, profesjonalny.' },
              { id: 'Kore', title: 'EVA - Głos Żeński 2', desc: 'Młodszy, energiczny.' },
              { id: 'Puck', title: 'EVAN - Głos Męski 1', desc: 'Młody, energiczny.' },
              { id: 'Charon', title: 'EVAN - Głos Męski 2', desc: 'Głęboki, dojrzały, autorytatywny.' }
            ].map(opt => (
              <div 
                key={opt.id}
                onClick={() => setAiVoice(opt.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${aiVoice === opt.id ? 'border-primary bg-gold-50/30' : 'border-surface-200 hover:border-gold-300'}`}
              >
                <div className="font-medium text-surface-900">{opt.title}</div>
                <div className="text-sm text-surface-500 mt-1">{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={saveTenantSettings}
          disabled={isSaving}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-surface-800 hover:text-white transition-colors"
        >
          <Save className="w-4 h-4" /> Zapisz Profil
        </button>
      </div>

      {businessProfile === 'facility' && (
        <div className="glass-card rounded-2xl p-6 shadow-sm border border-surface-200/60 mt-6 mb-6">
          <h3 className="text-xl font-serif text-surface-900 mb-6">Tryb kalendarza (Obiekty)</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div 
              onClick={() => setBookingMode('hourly')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${bookingMode === 'hourly' ? 'border-primary bg-gold-50/30' : 'border-surface-200 hover:border-gold-300'}`}
            >
              <div className="font-medium text-surface-900">Godzinowy</div>
              <div className="text-sm text-surface-500 mt-1">Rezerwacje na konkretne godziny (np. gabinety, sale prób).</div>
            </div>
            <div 
              onClick={() => setBookingMode('daily')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${bookingMode === 'daily' ? 'border-primary bg-gold-50/30' : 'border-surface-200 hover:border-gold-300'}`}
            >
              <div className="font-medium text-surface-900">Dobowy</div>
              <div className="text-sm text-surface-500 mt-1">Rezerwacje na noce/doby (np. pokoje, apartamenty, hotele).</div>
            </div>
          </div>
        </div>
      )}

      {businessProfile !== 'solo' && (
        <div className="glass-card rounded-2xl p-6 shadow-sm border border-surface-200/60">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-serif text-surface-900">Zarządzanie Zespołem / Zasobami</h3>
            <button 
              onClick={openAddStaff}
              className="bg-surface-100 text-surface-900 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-surface-200 transition-colors"
            >
              <Plus className="w-4 h-4" /> Dodaj
            </button>
          </div>

          <div className="space-y-3">
            {staffList.map(staff => (
              <div key={staff.id} className="flex justify-between items-center p-4 bg-surface-50 rounded-xl border border-surface-100">
                <div className="flex items-center gap-4">
                  <div className="bg-gold-100 p-2 rounded-lg text-gold-700">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-surface-900">{staff.name}</div>
                    <div className="text-xs text-surface-500">{staff.role || 'Pracownik'}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditStaff(staff)} className="text-sm text-surface-600 hover:text-surface-900 px-3 py-1.5 bg-white border border-surface-200 rounded-lg shadow-sm">Edytuj</button>
                  <button onClick={() => deleteStaff(staff.id)} className="text-sm text-red-600 hover:text-red-700 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg shadow-sm">Usuń</button>
                </div>
              </div>
            ))}
            {staffList.length === 0 && <div className="text-surface-500 text-center py-4">Brak dodanych pracowników.</div>}
          </div>
        </div>
      )}

      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/40 backdrop-blur-sm px-4">
          <div className="glass-card rounded-2xl p-6 relative w-full max-w-md shadow-2xl">
            <button onClick={() => setIsStaffModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-surface-400 hover:text-surface-900 hover:bg-surface-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-serif text-surface-900 mb-4">{currentStaff ? 'Edytuj Pracownika' : 'Dodaj Pracownika'}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Imię i nazwisko / Nazwa zasobu</label>
                <input 
                  type="text" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})}
                  className="w-full bg-white border border-surface-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-gold-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Rola (np. Stylista / Gabinet)</label>
                <input 
                  type="text" value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})}
                  className="w-full bg-white border border-surface-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-gold-500/50"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-medium text-surface-500 mb-1">Godziny pracy</label>
                  <button type="button" onClick={() => {
                    const mon = staffForm.schedule["1"];
                    const newSch = { ...staffForm.schedule };
                    ["2","3","4","5"].forEach(d => newSch[d] = { ...mon });
                    setStaffForm({...staffForm, schedule: newSch});
                  }} className="text-xs text-primary hover:underline">Kopiuj z Pn na Pn-Pt</button>
                </div>
                <div className="border border-surface-200 rounded-xl overflow-hidden text-sm">
                  {["1", "2", "3", "4", "5", "6", "0"].map(day => {
                    const dayNames:any = {"1": "Pn", "2": "Wt", "3": "Śr", "4": "Cz", "5": "Pt", "6": "Sb", "0": "Nd"};
                    const ds = staffForm.schedule[day] || { isWorking: false, start: "09:00", end: "17:00" };
                    return (
                      <div key={day} className="flex items-center gap-2 p-2 bg-white border-b border-surface-100 last:border-0">
                        <div translate="no" className="w-8 font-medium text-surface-600">{dayNames[day]}</div>
                        <input type="checkbox" checked={ds.isWorking} onChange={e => {
                          setStaffForm({...staffForm, schedule: {...staffForm.schedule, [day]: {...ds, isWorking: e.target.checked}}});
                        }} className="rounded text-gold-600 focus:ring-gold-500" />
                        
                        <input type="time" value={ds.start} disabled={!ds.isWorking} onChange={e => {
                          setStaffForm({...staffForm, schedule: {...staffForm.schedule, [day]: {...ds, start: e.target.value}}});
                        }} className="border border-surface-200 rounded px-1 disabled:opacity-50" />
                        <span className="text-surface-400">-</span>
                        <input type="time" value={ds.end} disabled={!ds.isWorking} onChange={e => {
                          setStaffForm({...staffForm, schedule: {...staffForm.schedule, [day]: {...ds, end: e.target.value}}});
                        }} className="border border-surface-200 rounded px-1 disabled:opacity-50" />
                      </div>
                    )
                  })}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-2">Wykonywane Usługi</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {services.map(svc => (
                    <label key={svc.id} className="flex items-center gap-2 text-sm text-surface-800">
                      <input 
                        type="checkbox" 
                        checked={staffForm.serviceIds.includes(svc.id)}
                        onChange={() => toggleService(svc.id)}
                        className="rounded border-surface-300 text-gold-600 focus:ring-gold-500"
                      />
                      {svc.name}
                    </label>
                  ))}
                  {services.length === 0 && <span className="text-xs text-surface-500">Brak dostępnych usług.</span>}
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button onClick={() => setIsStaffModalOpen(false)} className="flex-1 py-2 bg-surface-100 rounded-xl text-sm font-medium hover:bg-surface-200">Anuluj</button>
                <button onClick={saveStaff} className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-surface-800 hover:text-white transition-colors">Zapisz</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
