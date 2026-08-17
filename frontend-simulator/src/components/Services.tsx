import { useEffect, useState } from 'react';
import { Scissors, Clock, DollarSign, Pencil } from 'lucide-react';

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

export default function Services() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  if (loading) {
    return <div className="p-8 text-surface-500 animate-pulse">Ładowanie cennika...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Usługi i Cennik</h2>
          <p className="text-surface-500 mt-1">Zarządzaj usługami, które może oferować asystent głosowy.</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-surface-800 transition-colors shadow-sm self-start md:self-auto">
          Dodaj usługę
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map(svc => (
          <div key={svc.id} className="glass-card glass-card-hover rounded-2xl p-6 relative overflow-hidden group cursor-pointer">
            <button className="absolute top-4 right-4 text-surface-300 hover:text-gold-600 transition-colors z-10 bg-white/50 p-1 rounded-md backdrop-blur-sm">
              <Pencil className="w-4 h-4" />
            </button>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-surface-50 rounded-full transition-transform group-hover:scale-150 duration-500 -z-10" />
            
            <div className="bg-gold-50 w-12 h-12 rounded-xl flex items-center justify-center mb-6 border border-gold-100 text-gold-600 relative z-10">
              <Scissors className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-serif text-surface-900 mb-4">{svc.name}</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-surface-500">
                  <DollarSign className="w-4 h-4" />
                  <span>Cena</span>
                </div>
                <span className="font-medium text-surface-900">{svc.price} zł</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-surface-500">
                  <Clock className="w-4 h-4" />
                  <span>Czas trwania</span>
                </div>
                <span className="font-medium text-surface-900">{svc.durationMinutes} min</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
