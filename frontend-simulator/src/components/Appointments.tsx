import { useEffect, useState, useRef } from 'react';
import AppointmentsDaily from './AppointmentsDaily';
import { Calendar, Clock, User, Phone, Plus, ChevronLeft, ChevronRight, List, Grid, X, Tag } from 'lucide-react';

interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  status: string;
  staffId?: string;
  staff?: { name: string };
  service?: {
    name: string;
    id: string;
  };
}

const COLOR_CODES = [
  'bg-blue-600 border-blue-800',
  'bg-emerald-600 border-emerald-800',
  'bg-purple-600 border-purple-800',
  'bg-rose-600 border-rose-800',
  'bg-amber-600 border-amber-800',
  'bg-primary border-surface-800'
];

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [businessProfile, setBusinessProfile] = useState<string>('solo');
  const [bookingMode, setBookingMode] = useState<string>('hourly');
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'list' | 'schedule'>('schedule');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    startTime: '',
    endTime: '',
    serviceId: '',
    staffId: ''
  });

  const loadData = async () => {
    try {
      const [appRes, svcRes, staffRes, tenantRes] = await Promise.all([
        fetch('/api/appointments'),
        fetch('/api/services'),
        fetch('/api/staff'),
        fetch('/api/tenant')
      ]);
      const appData = await appRes.json();
      const svcData = await svcRes.json();
      const staffData = await staffRes.json();
      const tenantData = await tenantRes.json();
      
      setAppointments(appData);
      setServices(svcData);
      setStaffList(staffData);
      setBusinessProfile(tenantData?.businessProfile || 'solo');
      setBookingMode(tenantData?.bookingMode || 'hourly');
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    try {
      const isNew = !selectedAppt || selectedAppt.id === 'new';
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/appointments' : `/api/appointments/${selectedAppt.id}`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setSelectedAppt(null);
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Błąd zapisu wizyty.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!selectedAppt || selectedAppt.id === 'new') return;
    if (!confirm('Czy na pewno chcesz usunąć tę rezerwację?')) return;
    try {
      const res = await fetch(`/api/appointments/${selectedAppt.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedAppt(null);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const changeDay = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + offset);
    setCurrentDate(newDate);
  };

  const getAppointmentsForCurrentDate = () => {
    return appointments.filter(app => {
      const appDate = new Date(app.startTime);
      return appDate.toDateString() === currentDate.toDateString();
    });
  };

  const START_HOUR = 6;
  const END_HOUR = 22;
  const timeSlots: string[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
  }

  const isWorkingHour = (col: any, timeStr: string) => {
    if (col.id === 'solo') return true;
    
    const day = currentDate.getDay().toString();
    
    // Jeśli schedule to string, musimy go sparsować
    let scheduleObj = col.schedule;
    if (typeof scheduleObj === 'string') {
      try { scheduleObj = JSON.parse(scheduleObj); } catch(e) {}
    }
    
    const schedule = scheduleObj?.[day];
    if (!schedule || !schedule.isWorking) return false;

    const [startH, startM] = (schedule.start || '09:00').split(':').map(Number);
    const [endH, endM] = (schedule.end || '17:00').split(':').map(Number);
    const [slotH, slotM] = timeStr.split(':').map(Number);
    
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    const slotMin = slotH * 60 + slotM;
    
    return slotMin >= startMin && slotMin < endMin;
  };

  const openAddModal = (time?: string, staffId?: string) => {
    const start = new Date(currentDate);
    if (time) {
      const [hh, mm] = time.split(':').map(Number);
      start.setHours(hh, mm, 0, 0);
    } else {
      start.setHours(10, 0, 0, 0);
    }
    const end = new Date(start.getTime() + 30 * 60000);

    const tzStart = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0,16);
    const tzEnd = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0,16);

    setSelectedAppt({ id: 'new', customerName: '', customerPhone: '', startTime: tzStart, endTime: tzEnd, status: 'confirmed' });
    setIsEditing(true);
    setFormData({
      customerName: '',
      customerPhone: '',
      startTime: tzStart,
      endTime: tzEnd,
      serviceId: services[0]?.id || '',
      staffId: staffId || (staffList[0]?.id || '')
    });
  };

  const openEditModal = (app: Appointment) => {
    setSelectedAppt(app);
    setIsEditing(false);
    
    const start = new Date(app.startTime);
    const end = new Date(app.endTime);
    const tzStart = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0,16);
    const tzEnd = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0,16);

    setFormData({
      customerName: app.customerName,
      customerPhone: app.customerPhone,
      startTime: tzStart,
      endTime: tzEnd,
      serviceId: app.service?.id || services[0]?.id || '',
      staffId: app.staffId || ''
    });
  };

  const getColorCode = (serviceId: string) => {
    if (!serviceId) return COLOR_CODES[5];
    const index = services.findIndex(s => s.id === serviceId);
    if (index === -1) return COLOR_CODES[5];
    return COLOR_CODES[index % COLOR_CODES.length];
  };

  const columns = (businessProfile !== 'solo' && staffList.length > 0) 
    ? staffList 
    : [{ id: 'solo', name: 'Kalendarz Główny' }];
    
  useEffect(() => {
    if (loading) return;
    let firstWorkingIndex = -1;
    for (let i = 0; i < timeSlots.length; i++) {
      if (columns.some(col => isWorkingHour(col, timeSlots[i]))) {
        firstWorkingIndex = i;
        break;
      }
    }
    if (firstWorkingIndex > 0 && scrollContainerRef.current) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: firstWorkingIndex * 48, behavior: 'smooth' });
        }
      }, 50);
    }
  }, [currentDate, loading, columns.length]);

  if (loading) {
    return <div className="p-8 text-surface-500 animate-pulse">Ładowanie rezerwacji...</div>;
  }
  const dailyApps = getAppointmentsForCurrentDate();

  if (bookingMode === 'daily' && businessProfile === 'facility') {
    return <AppointmentsDaily appointments={appointments} services={services} staffList={staffList} loadData={loadData} loading={loading} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Rezerwacje</h2>
          <p className="text-surface-500 mt-1">Zarządzaj kalendarzem i wizytami swoich klientów.</p>
        </div>
        
        <div className="flex items-center gap-3 self-start lg:self-auto">
          <button 
            onClick={() => loadData()}
            className="p-2 bg-surface-100 hover:bg-surface-200 text-surface-600 rounded-lg transition-colors border border-surface-200 shadow-sm"
            title="Odśwież kalendarz"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          
          <div className="bg-white border border-surface-200 rounded-lg flex p-1 shadow-sm">
            <button 
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${view === 'list' ? 'bg-surface-100 text-surface-900' : 'text-surface-400 hover:text-surface-700'}`}
              title="Widok listy"
            >
              <List className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setView('schedule')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${view === 'schedule' ? 'bg-surface-100 text-surface-900' : 'text-surface-400 hover:text-surface-700'}`}
              title="Widok grafiku"
            >
              <Grid className="w-5 h-5" />
            </button>
          </div>
          
          <button 
            onClick={() => openAddModal()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-surface-800 hover:text-white transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Dodaj wizytę
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {appointments.map(app => (
            <div key={app.id} className="glass-card glass-card-hover rounded-xl p-4 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div className="text-xl font-serif text-surface-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-gold-500" />
                  {formatTime(app.startTime)}
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 uppercase tracking-wide">
                  {app.status}
                </span>
              </div>
              <div className="text-xs font-medium text-surface-500 capitalize mb-3">{formatDate(app.startTime)}</div>
              
              <div className="space-y-1.5 bg-surface-50 p-2.5 rounded-lg border border-surface-100">
                <div className="flex items-center gap-2 text-surface-800">
                  <User className="w-3.5 h-3.5 text-surface-400" />
                  <span className="text-sm font-medium truncate">{app.customerName}</span>
                </div>
                <div className="flex items-center gap-2 text-surface-600">
                  <Phone className="w-3.5 h-3.5 text-surface-400" />
                  <span className="text-xs">{app.customerPhone}</span>
                </div>
                {app.service?.name && (
                  <div className="flex items-center gap-2 text-surface-600 border-t border-surface-200/60 pt-1.5 mt-1.5">
                    <Tag className="w-3.5 h-3.5 text-surface-400" />
                    <span className="text-xs font-medium text-surface-800 truncate">{app.service.name}</span>
                  </div>
                )}
                {app.staff?.name && (
                  <div className="flex items-center gap-2 text-surface-600">
                    <User className="w-3.5 h-3.5 text-surface-400" />
                    <span className="text-xs font-medium truncate">{app.staff.name}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {appointments.length === 0 && (
            <div className="col-span-full py-12 text-center text-surface-500 glass-card rounded-2xl">
              Brak nadchodzących rezerwacji.
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-2xl shadow-sm border border-surface-200/60 overflow-hidden flex flex-col h-[75vh]">
          <div className="bg-surface-50 border-b border-surface-200 p-4 flex items-center justify-between z-20 shrink-0 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => changeDay(-1)} className="p-1.5 hover:bg-surface-200 rounded-lg text-surface-600 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div 
                className="w-48 text-center relative cursor-pointer group flex flex-col items-center justify-center"
                onClick={(e) => {
                  try {
                    const input = e.currentTarget.querySelector('input');
                    if (input && 'showPicker' in input) {
                      input.showPicker();
                    }
                  } catch (err) {}
                }}
              >
                <input 
                  type="date" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  value={`${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`}
                  onChange={(e) => {
                    if (e.target.value) setCurrentDate(new Date(e.target.value));
                  }}
                />
                <div className="font-serif text-lg text-surface-900 capitalize group-hover:text-gold-600 transition-colors flex items-center gap-1.5">
                  {currentDate.toLocaleDateString('pl-PL', { weekday: 'long' })}
                  <Calendar className="w-4 h-4 text-surface-300 group-hover:text-gold-500" />
                </div>
                <div className="text-xs text-surface-500">{currentDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              </div>
              <button onClick={() => changeDay(1)} className="p-1.5 hover:bg-surface-200 rounded-lg text-surface-600 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="text-sm font-medium text-gold-600 hover:text-gold-700 bg-gold-50 hover:bg-gold-100 px-3 py-1.5 rounded-lg transition-colors border border-gold-200/50"
              >
                Dzisiaj
              </button>
            </div>
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-surface-50/30 relative shadow-inner">
            <div className="h-full flex flex-col" style={{ minWidth: `max(100%, ${columns.length * 180 + 80}px)` }}>
              
              <div className="flex sticky top-0 z-20 bg-white border-b border-surface-200 shadow-sm">
                <div className="w-20 shrink-0 bg-surface-50 border-r border-surface-200"></div>
                {columns.map(col => (
                  <div key={col.id} className="flex-1 text-center py-3 border-r border-surface-200 font-medium text-surface-800 text-sm">
                    {col.name}
                  </div>
                ))}
              </div>

              <div className="relative">
                {timeSlots.map(time => {
                  return (
                    <div key={time} className="flex border-b border-surface-100 h-12">
                      <div className="w-20 shrink-0 text-right pr-4 pt-1 border-r border-surface-200 bg-surface-50/50">
                        <span className="text-[11px] font-medium text-surface-400">{time}</span>
                      </div>
                      {columns.map(col => {
                        const isWorking = isWorkingHour(col, time);
                        return (
                          <div 
                            key={col.id} 
                            className={`flex-1 border-r border-surface-100 transition-colors group relative ${
                                isWorking 
                                  ? 'hover:bg-gold-50/20 cursor-pointer bg-transparent' 
                                  : 'bg-surface-100 cursor-not-allowed'
                            }`}
                            onClick={() => {
                              if (isWorking) openAddModal(time, col.id === 'solo' ? undefined : col.id);
                            }}
                          >
                            {isWorking && (
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                                <Plus className="w-4 h-4 text-gold-400" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                <div className="absolute inset-0 flex">
                  <div className="w-20 shrink-0"></div>
                  {columns.map(col => {
                    const apps = dailyApps.filter(a => {
                      if (businessProfile === 'solo') return true;
                      if (col.id === 'solo') return !a.staffId;
                      return a.staffId === col.id;
                    });

                    return (
                      <div key={`events-${col.id}`} className="flex-1 relative">
                        {apps.map(app => {
                          const start = new Date(app.startTime);
                          const end = new Date(app.endTime);
                          const startHour = start.getHours() + start.getMinutes() / 60;
                          const endHour = end.getHours() + end.getMinutes() / 60;
                          const startOffsetHours = startHour - START_HOUR;
                          const topPx = startOffsetHours * 96;
                          const durationHours = endHour - startHour;
                          const heightPx = durationHours * 96;
                          const bgColor = getColorCode(app.service?.id || '');

                          return (
                            <div 
                              key={app.id} 
                              onClick={(e) => { e.stopPropagation(); openEditModal(app); }}
                              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                              className={`absolute left-1 right-2 z-10 ${bgColor} text-white p-2 rounded-xl shadow-md flex flex-col overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer`}
                            >
                              <span className="font-semibold text-xs truncate drop-shadow-sm">{app.customerName}</span>
                              <span className="text-[10px] opacity-90 truncate">{app.service?.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/40 backdrop-blur-sm px-4">
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden group w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedAppt(null)}
              className="absolute top-4 right-4 p-1.5 text-surface-400 hover:text-surface-900 hover:bg-surface-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gold-50 p-2.5 rounded-xl text-gold-600">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl text-surface-900">
                {selectedAppt.id === 'new' ? 'Nowa Wizyta' : 'Szczegóły Wizyty'}
              </h3>
            </div>

            {!isEditing && selectedAppt.id !== 'new' ? (
              <div className="space-y-4">
                <div className="bg-surface-50 rounded-xl p-4 border border-surface-100 space-y-3">
                  <div className="flex items-center gap-3 text-surface-800">
                    <User className="w-4 h-4 text-surface-400" />
                    <span className="font-medium">{selectedAppt.customerName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-surface-600">
                    <Phone className="w-4 h-4 text-surface-400" />
                    <span className="text-sm">{selectedAppt.customerPhone}</span>
                  </div>
                  {selectedAppt.service && (
                    <div className="flex items-center gap-3 text-surface-600">
                      <Tag className="w-4 h-4 text-surface-400" />
                      <span className="text-sm">{selectedAppt.service.name}</span>
                    </div>
                  )}
                  {selectedAppt.staff && (
                    <div className="flex items-center gap-3 text-surface-600">
                      <User className="w-4 h-4 text-surface-400" />
                      <span className="text-sm">{selectedAppt.staff.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-surface-600">
                    <Clock className="w-4 h-4 text-surface-400" />
                    <span className="text-sm">
                      {formatDate(selectedAppt.startTime)}, {formatTime(selectedAppt.startTime)} - {formatTime(selectedAppt.endTime)}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex-1 bg-surface-100 text-surface-900 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-surface-200 transition-colors"
                  >
                    Edytuj
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="flex-1 bg-red-50 text-red-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
                  >
                    Usuń
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Imię klienta</label>
                  <input 
                    type="text" 
                    value={formData.customerName}
                    onChange={e => setFormData({...formData, customerName: e.target.value})}
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Telefon</label>
                  <input 
                    type="text" 
                    value={formData.customerPhone}
                    onChange={e => setFormData({...formData, customerPhone: e.target.value})}
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Usługa</label>
                  <select 
                    value={formData.serviceId}
                    onChange={e => setFormData({...formData, serviceId: e.target.value})}
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                  >
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes} min)</option>)}
                  </select>
                </div>
                {staffList.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Osoba / Zasób</label>
                    <select 
                      value={formData.staffId}
                      onChange={e => setFormData({...formData, staffId: e.target.value})}
                      className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                    >
                      <option value="">Wybierz osobę / zasób</option>
                      {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Od</label>
                    <input 
                      type="datetime-local" 
                      value={formData.startTime}
                      onChange={e => setFormData({...formData, startTime: e.target.value})}
                      className="w-full bg-surface-50 border border-surface-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1">Do</label>
                    <input 
                      type="datetime-local" 
                      value={formData.endTime}
                      onChange={e => setFormData({...formData, endTime: e.target.value})}
                      className="w-full bg-surface-50 border border-surface-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                    />
                  </div>
                </div>
                <div className="pt-2 flex gap-2">
                  <button 
                    onClick={handleSave}
                    className="flex-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-surface-800 transition-colors"
                  >
                    Zapisz
                  </button>
                  {selectedAppt.id !== 'new' && (
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="flex-1 bg-surface-100 text-surface-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-surface-200 transition-colors"
                    >
                      Anuluj
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
