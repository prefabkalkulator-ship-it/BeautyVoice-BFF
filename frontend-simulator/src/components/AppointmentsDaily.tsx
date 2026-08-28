import React, { useState } from 'react';
import {  Calendar, ChevronLeft, ChevronRight, Edit2, X, Save , Plus, Gift, CheckCircle, Tag, User, Phone, Clock, Star } from 'lucide-react';

export default function AppointmentsDaily({ appointments, services, staffList, loadData, loading }: any) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Automatyczne przewijanie do 'wczoraj' po załadowaniu lub zmianie miesiąca
    if (scrollRef.current) {
      const today = new Date();
      if (today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()) {
        const currentDay = today.getDate();
        // Chcemy widzieć wczoraj, dzisiaj, jutro. Wczoraj to (currentDay - 1). 
        // 1 dzień to 48px (w-12). Zostawiamy mały margines, np. 2 dni wcześniej = (currentDay - 3)
        const targetDay = Math.max(1, currentDay - 2); 
        const scrollAmount = (targetDay - 1) * 48; // w-12 = 48px
        scrollRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
      } else {
        // Inny miesiąc, scroll na początek
        scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      }
    }
  }, [currentDate.getMonth(), currentDate.getFullYear(), loading]);
  
  // Przejście o miesiąc w tył/przód
  const goPrev = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };
  const goNext = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysCount = getDaysInMonth(year, month);
  const daysArray = Array.from({length: daysCount}, (_, i) => i + 1);

  const monthName = currentDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });

  // Add/Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<any>(null);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    startDate: '',
    endDate: '',
    serviceId: '',
    staffId: ''
  });

  const openAddModal = (staffId: string, day: number) => {
    const d = new Date(year, month, day, 14, 0, 0); // 14:00 zameldowanie
    const end = new Date(year, month, day + 1, 11, 0, 0); // 11:00 wymeldowanie na nast dzien
    
    // adjust for local timezone offset when slicing ISO string
    const tzOffsetMs = d.getTimezoneOffset() * 60000;
    const startStr = new Date(d.getTime() - tzOffsetMs).toISOString().slice(0,10);
    const endStr = new Date(end.getTime() - tzOffsetMs).toISOString().slice(0,10);

    setFormData({
      customerName: '',
      customerPhone: '',
      startDate: startStr,
      endDate: endStr,
      serviceId: services[0]?.id || '',
      staffId: staffId || (staffList.length > 0 ? staffList[0].id : '')
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (app: any) => {
    setSelectedAppt(app);
    const start = new Date(app.startTime);
    const end = new Date(app.endTime);
    const tzStart = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0,10);
    const tzEnd = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0,10);

    setFormData({
      customerName: app.customerName,
      customerPhone: app.customerPhone,
      startDate: tzStart,
      endDate: tzEnd,
      serviceId: app.service?.id || services[0]?.id || '',
      staffId: app.staffId || ''
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const saveAppointment = async (e: any) => {
    e.preventDefault();
    try {
      const startIso = new Date(`${formData.startDate}T14:00:00+02:00`).toISOString();
      const endIso = new Date(`${formData.endDate}T11:00:00+02:00`).toISOString();

      if (isEditing) {
        await fetch(`/api/appointments/${selectedAppt.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, startTime: startIso, endTime: endIso })
        });
      } else {
        await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, startTime: startIso, endTime: endIso })
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      alert('Błąd zapisu');
    }
  };

  const deleteAppointment = async () => {
    if (!confirm('Usunąć?')) return;
    try {
      await fetch(`/api/appointments/${selectedAppt.id}`, { method: 'DELETE' });
      setIsModalOpen(false);
      loadData();
    } catch (err) {}
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Rezerwacje Dobowe</h2>
          <p className="text-surface-500 mt-1">Zarządzaj obiektami i zasobami w trybie dobowym.</p>
        </div>
        
        
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button 
              onClick={() => openAddModal('', 1)}
              className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Nowa Rezerwacja
            </button>
            <div className="flex items-center bg-white border border-surface-200 rounded-lg p-1 shadow-sm">

            <button onClick={goPrev} className="p-2 text-surface-400 hover:text-surface-700"><ChevronLeft className="w-5 h-5"/></button>
            <div className="px-4 font-serif capitalize text-surface-900 text-lg min-w-[150px] text-center">{monthName}</div>
            <button onClick={goNext} className="p-2 text-surface-400 hover:text-surface-700"><ChevronRight className="w-5 h-5"/></button>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl border border-surface-200/60 overflow-hidden bg-white shadow-xl">
        <div className="overflow-x-auto pb-4" ref={scrollRef}>
          <div className="min-w-max">
            {/* Header row - Dates */}
            <div className="flex border-b border-surface-200 bg-surface-50">
              <div className="w-24 sm:w-32 lg:w-48 shrink-0 p-2 lg:p-4 font-serif text-xs lg:text-base text-surface-900 flex items-center border-r border-surface-200 sticky left-0 z-30 bg-surface-50 shadow-[2px_0_5px_rgba(0,0,0,0.05)] truncate overflow-hidden">
                Obiekty / Zasoby
              </div>
              <div className="flex-1 flex">
                {daysArray.map(day => (
                  <div key={day} className="w-12 shrink-0 border-r border-surface-100 flex flex-col items-center justify-center p-2">
                    <span className="text-xs text-surface-400">{new Date(year, month, day).toLocaleDateString('pl-PL', {weekday: 'short'}).charAt(0)}</span>
                    <span className="font-semibold text-surface-700">{day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rows - Resources */}
            {staffList.map((room: any) => (
              <div key={room.id} className="flex border-b border-surface-100 relative group min-h-[64px]">
                <div className="w-24 sm:w-32 lg:w-48 shrink-0 p-2 lg:p-4 font-medium text-xs lg:text-base text-surface-800 bg-white z-30 border-r border-surface-200 sticky left-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)] truncate overflow-hidden" title={room.name}>
                  {room.name}
                </div>
                <div className="flex-1 flex relative bg-white">
                  {/* Grid cells */}
                  {daysArray.map(day => (
                    <div 
                      key={day} 
                      onClick={() => openAddModal(room.id, day)}
                      className="w-12 shrink-0 border-r border-surface-100 hover:bg-gold-50/50 cursor-pointer transition-colors"
                    ></div>
                  ))}

                  {/* Render appointments */}
                  {appointments.filter((a: any) => a.staffId === room.id).map((app: any) => {
                    const start = new Date(app.startTime);
                    const end = new Date(app.endTime);
                    
                    const monthStart = new Date(year, month, 1);
                    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
                    
                    if (end < monthStart || start > monthEnd) return null;

                    let startDay = start.getDate();
                    let endDay = end.getDate();
                    
                    let leftOffsetDays = startDay - 1;
                    if (start < monthStart) leftOffsetDays = 0;
                    
                    let durationDays = 0;
                    if (start < monthStart) {
                      if (end > monthEnd) durationDays = daysCount;
                      else durationDays = endDay;
                    } else {
                      if (end > monthEnd) durationDays = daysCount - startDay + 1;
                      else durationDays = endDay - startDay;
                    }
                    
                    if (durationDays <= 0) durationDays = 1;

                    // leftPx is calculated by number of days (48px per day). Start exactly at middle (24px)
                    const leftPx = leftOffsetDays * 48 + 24; 
                    const widthPx = durationDays * 48;

                    return (
                      <div 
                        key={app.id}
                        onClick={(e) => { e.stopPropagation(); openEditModal(app); }}
                        className={`absolute top-2 bottom-2 rounded-lg shadow-md border flex flex-col p-1.5 overflow-hidden cursor-pointer hover:scale-[1.02] transition-all z-20 ${
                          app.status === 'confirmed_by_client' 
                            ? 'bg-gold-500 text-white border-4 border-green-500 hover:bg-gold-600' 
                            : 'bg-gold-500 text-white border border-gold-600 hover:bg-gold-600'
                        }`}
                        style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                      >
                        <div className="font-semibold text-[11px] truncate leading-tight drop-shadow-sm">{app.customerName}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-surface-50 px-6 py-5 border-b border-surface-100 flex justify-between items-center">
              <h3 className="text-xl font-serif text-surface-900">
                {isEditing ? 'Edytuj rezerwację' : 'Nowa rezerwacja'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-surface-400 hover:text-surface-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={saveAppointment} className="p-6 space-y-5">
              {(selectedAppt?.status === 'confirmed_by_client' || selectedAppt?.promoCode) && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200 space-y-2 mb-4">
                  {selectedAppt?.status === 'confirmed_by_client' && (
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Potwierdzone przez klienta (SMS/Głos)
                    </div>
                  )}
                  {selectedAppt?.npsScore && (
                    <div className="flex items-center gap-2 text-yellow-700 font-medium">
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                      Ocena klienta: {selectedAppt.npsScore} / 5
                    </div>
                  )}
                  {selectedAppt?.promoCode && (
                    <div className="flex items-center gap-2 text-amber-700 font-medium">
                      <Gift className="w-5 h-5 text-amber-600" />
                      Użyty rabat: {selectedAppt.promoCode}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Imię klienta</label>
                  <input type="text" required value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-gold-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Telefon</label>
                  <input type="text" required value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-gold-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Początek</label>
                    <input type="date" required value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Koniec</label>
                    <input type="date" required value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Obiekt / Zasób</label>
                  <select value={formData.staffId} onChange={e => setFormData({...formData, staffId: e.target.value})} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5">
                    {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Usługa / Kategoria</label>
                  <select value={formData.serviceId} onChange={e => setFormData({...formData, serviceId: e.target.value})} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5">
                    {services.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.price} zł/noc)</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-between gap-3 border-t border-surface-100">
                {isEditing ? (
                  <button type="button" onClick={deleteAppointment} className="px-5 py-2.5 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-colors">Usuń</button>
                ) : <div></div>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-surface-600 font-medium hover:bg-surface-100 rounded-xl transition-colors">Anuluj</button>
                  <button type="submit" className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium flex items-center gap-2">
                    <Save className="w-4 h-4" /> Zapisz
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
