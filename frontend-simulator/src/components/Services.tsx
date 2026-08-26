import { useEffect, useState } from 'react';
import { Tag, Clock, DollarSign, Pencil, Check, X, Trash2 } from 'lucide-react';

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}


const formatDuration = (totalMin: number) => {
  if (!totalMin) return '0 min';
  if (totalMin >= 1440 && totalMin % 1440 === 0) return `${totalMin / 1440} dob.`;
  if (totalMin >= 60 && totalMin % 60 === 0) return `${totalMin / 60} h`;
  if (totalMin > 60) return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
  return `${totalMin} min`;
};

const calculateUnitAndValue = (totalMin: number) => {
  if (!totalMin) return { val: '', unit: 'min' };
  if (totalMin >= 1440 && totalMin % 1440 === 0) return { val: totalMin / 1440, unit: 'd' };
  if (totalMin >= 60 && totalMin % 60 === 0) return { val: totalMin / 60, unit: 'h' };
  return { val: totalMin, unit: 'min' };
};

export default function Services() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Stan edycji in-line
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState<number | ''>('');
  const [editDuration, setEditDuration] = useState<number | ''>('');
  const [editDurationUnit, setEditDurationUnit] = useState<'min' | 'h' | 'd'>('min');

  const fetchServices = () => {
    fetch('/api/services')
      .then(res => res.json())
      .then(data => {
        setServices(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const startEditing = (svc: ServiceItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(svc.id);
    setEditName(svc.name);
    setEditPrice(svc.price);
    const { val, unit } = calculateUnitAndValue(svc.durationMinutes);
      setEditDuration(val);
      setEditDurationUnit(unit as any);
  };

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId) return;
    try {
      const isNewService = editingId.startsWith('new-');
      const method = isNewService ? 'POST' : 'PUT';
      const url = isNewService ? '/api/services' : `/api/services/${editingId}`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, price: Number(editPrice), durationMinutes: Number(editDuration) * (editDurationUnit === 'd' ? 1440 : editDurationUnit === 'h' ? 60 : 1) })
      });
      if (res.ok) {
        const savedService = await res.json();
        if (isNewService) {
          setServices(services.map(s => s.id === editingId ? savedService : s));
        } else {
          setServices(services.map(s => s.id === editingId ? { ...s, name: editName, price: Number(editPrice) || 0, durationMinutes: (Number(editDuration) || 0) * (editDurationUnit === 'd' ? 1440 : editDurationUnit === 'h' ? 60 : 1) } : s));
        }
        setEditingId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteService = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id.startsWith('new-')) {
      setServices(services.filter(s => s.id !== id));
      setEditingId(null);
      return;
    }
    if (!confirm('Na pewno usunąć tę usługę?')) return;
    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setServices(services.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addNewService = () => {
    const newService: ServiceItem = {
      id: `new-${Date.now()}`,
      name: '',
      price: 0,
      durationMinutes: 30
    };
    setServices([newService, ...services]);
    setEditingId(newService.id);
      setEditName('');
      setEditPrice('');
      setEditDuration('');
      setEditDurationUnit('min');
  };

  if (loading) {
    return <div className="p-8 text-surface-500 animate-pulse">Ładowanie cennika...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Usługi i Cennik</h2>
          <p className="text-surface-500 mt-1">Zarządzaj usługami, które EVA oferuje klientom.</p>
        </div>
        <button 
          onClick={addNewService}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-surface-800 hover:text-white transition-colors shadow-sm self-start md:self-auto"
        >
          Dodaj usługę
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map(svc => {
          const isEditing = editingId === svc.id;
          return (
            <div key={svc.id} className={`glass-card rounded-2xl p-6 relative overflow-hidden group transition-all ${!isEditing ? 'glass-card-hover' : 'border-gold-300 shadow-md'}`}>
              
              {!isEditing ? (
                <button 
                  onClick={(e) => startEditing(svc, e)}
                  className="absolute top-4 right-4 text-surface-300 hover:text-gold-600 transition-colors z-10 bg-white/50 p-1.5 rounded-lg backdrop-blur-sm shadow-sm"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              ) : (
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                  <button onClick={saveEdit} className="text-green-600 p-1.5 bg-green-50 hover:bg-green-100 rounded-lg shadow-sm"><Check className="w-4 h-4" /></button>
                  <button onClick={(e) => deleteService(svc.id, e)} className="text-red-500 p-1.5 bg-red-50 hover:bg-red-100 rounded-lg shadow-sm"><Trash2 className="w-4 h-4" /></button>
                  <button onClick={() => setEditingId(null)} className="text-surface-500 p-1.5 bg-surface-100 hover:bg-surface-200 rounded-lg shadow-sm"><X className="w-4 h-4" /></button>
                </div>
              )}

              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-surface-50 rounded-full transition-transform group-hover:scale-150 duration-500 -z-10" />
              
              <div className="bg-gold-50 w-12 h-12 rounded-xl flex items-center justify-center mb-6 border border-gold-100 text-gold-600 relative z-10">
                <Tag className="w-6 h-6" />
              </div>

              {isEditing ? (
                <div className="mb-4 pr-12">
                   <label className="text-xs text-surface-500 font-medium mb-1 block">Nazwa usługi</label>
                   <input 
                     type="text" 
                     value={editName} 
                     onChange={(e) => setEditName(e.target.value)}
                     placeholder="Nazwa usługi..."
                     className="w-full text-lg font-serif text-surface-900 bg-surface-50 border border-surface-200 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                   />
                </div>
              ) : (
                <h3 className="text-lg font-serif text-surface-900 mb-4 pr-8 leading-snug min-h-[3rem]">{svc.name}</h3>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-surface-500">
                    <DollarSign className="w-4 h-4" />
                    <span>Cena (zł)</span>
                  </div>
                  {isEditing ? (
                    <input 
                      type="number" 
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value ? Number(e.target.value) : '')}
                      placeholder="0"
                      className="w-20 text-right bg-surface-50 border border-surface-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                    />
                  ) : (
                    <span className="font-medium text-surface-900">{svc.price} zł</span>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-surface-500">
                    <Clock className="w-4 h-4" />
                    <span>Czas</span>
                  </div>
                  {isEditing ? (
                    <div className="flex gap-1">
                        <input 
                          type="number"
                          step="5"
                          value={editDuration}
                          onChange={(e) => setEditDuration(e.target.value ? Number(e.target.value) : '')}
                          placeholder="30"
                          className="w-16 text-right bg-surface-50 border border-surface-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                        />
                        <select value={editDurationUnit} onChange={(e) => setEditDurationUnit(e.target.value as any)} className="bg-surface-50 border border-surface-200 rounded-lg px-1 py-1 text-sm focus:outline-none">
                          <option value="min">min</option>
                          <option value="h">h</option>
                          <option value="d">dob</option>
                        </select>
                      </div>
                  ) : (
                    <span className="font-medium text-surface-900">{formatDuration(svc.durationMinutes)}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
