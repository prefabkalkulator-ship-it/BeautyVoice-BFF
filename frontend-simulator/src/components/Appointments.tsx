import { useEffect, useState } from 'react';
import { Calendar, Clock, User, Phone, Plus, ChevronLeft, ChevronRight, List, Grid, X, Scissors } from 'lucide-react';

interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  status: string;
  service?: {
    name: string;
  };
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'schedule'>('schedule');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  useEffect(() => {
    fetch('/api/appointments')
      .then(res => res.json())
      .then(data => {
        setAppointments(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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

  const timeSlots: string[] = [];
  for (let h = 8; h <= 20; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
  }

  if (loading) {
    return <div className="p-8 text-surface-500 animate-pulse">Ładowanie rezerwacji...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Rezerwacje</h2>
          <p className="text-surface-500 mt-1">Zarządzaj kalendarzem i wizytami swoich klientów.</p>
        </div>
        
        <div className="flex items-center gap-3 self-start lg:self-auto">
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
          
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-surface-800 transition-colors shadow-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Dodaj
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
                    <Scissors className="w-3.5 h-3.5 text-surface-400" />
                    <span className="text-xs font-medium text-surface-800 truncate">{app.service.name}</span>
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
        <div className="glass-card rounded-2xl shadow-sm border border-surface-200/60 overflow-hidden flex flex-col h-[65vh]">
          <div className="bg-surface-50 border-b border-surface-200 p-4 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-4">
              <button onClick={() => changeDay(-1)} className="p-1.5 hover:bg-surface-200 rounded-lg text-surface-600 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="w-48 text-center">
                <div className="font-serif text-lg text-surface-900 capitalize">{currentDate.toLocaleDateString('pl-PL', { weekday: 'long' })}</div>
                <div className="text-xs text-surface-500">{currentDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              </div>
              <button onClick={() => changeDay(1)} className="p-1.5 hover:bg-surface-200 rounded-lg text-surface-600 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button 
              onClick={() => setCurrentDate(new Date())}
              className="text-sm font-medium text-gold-600 hover:text-gold-700 bg-gold-50 hover:bg-gold-100 px-3 py-1.5 rounded-lg transition-colors border border-gold-200/50"
            >
              Dzisiaj
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-white relative">
            <div className="min-w-[600px]">
              {timeSlots.map((time, index) => {
                const appsInSlot = getAppointmentsForCurrentDate().filter(app => formatTime(app.startTime) === time);
                
                return (
                  <div key={time} className="flex border-b border-surface-100 group">
                    <div className="w-20 shrink-0 py-3 pr-4 text-right border-r border-surface-100 bg-surface-50/50">
                      <span className="text-xs font-medium text-surface-500">{time}</span>
                    </div>
                    <div className="flex-1 relative min-h-[48px] hover:bg-surface-50 transition-colors cursor-pointer group-hover:bg-surface-50/80">
                      
                      {appsInSlot.length === 0 && (
                        <div className="absolute inset-0 flex items-center px-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs font-medium text-gold-600 flex items-center gap-1 bg-gold-50 px-2 py-1 rounded-md border border-gold-100">
                            <Plus className="w-3 h-3" /> Dodaj wizytę
                          </span>
                        </div>
                      )}

                      {appsInSlot.map(app => {
                        const start = new Date(app.startTime).getTime();
                        const end = new Date(app.endTime).getTime();
                        const durationMins = (end - start) / 60000;
                        const heightPx = Math.max(48, (durationMins / 30) * 48);

                        return (
                          <div 
                            key={app.id} 
                            onClick={() => setSelectedAppt(app)}
                            style={{ height: `${heightPx}px` }}
                            className="absolute top-0 left-2 right-4 z-10 bg-primary text-primary-foreground p-3 rounded-xl shadow-md border border-surface-800 flex flex-col justify-center overflow-hidden hover:scale-[1.01] transition-transform cursor-pointer"
                          >
                            <span className="font-medium text-sm truncate">{app.customerName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Rezerwacji */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/40 backdrop-blur-sm px-4">
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden group w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedAppt(null)}
              className="absolute top-4 right-4 p-1 rounded-full text-surface-400 hover:text-surface-900 hover:bg-surface-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex justify-between items-start mb-6 pr-8">
              <div className="text-2xl font-serif text-surface-900 flex items-center gap-2">
                <Clock className="w-6 h-6 text-gold-500" />
                {formatTime(selectedAppt.startTime)}
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 uppercase tracking-wide">
                {selectedAppt.status}
              </span>
            </div>
            <div className="text-sm font-medium text-surface-500 capitalize mb-4">{formatDate(selectedAppt.startTime)}</div>
            <div className="space-y-2 bg-surface-50 p-4 rounded-xl border border-surface-100">
              <div className="flex items-center gap-3 text-surface-800">
                <User className="w-4 h-4 text-surface-400" />
                <span className="font-medium">{selectedAppt.customerName}</span>
              </div>
              <div className="flex items-center gap-3 text-surface-600">
                <Phone className="w-4 h-4 text-surface-400" />
                <span>{selectedAppt.customerPhone}</span>
              </div>
              {selectedAppt.service?.name && (
                <div className="flex items-center gap-3 text-surface-800 border-t border-surface-200/60 pt-2 mt-2">
                  <Scissors className="w-4 h-4 text-surface-400" />
                  <span className="font-medium">{selectedAppt.service.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
