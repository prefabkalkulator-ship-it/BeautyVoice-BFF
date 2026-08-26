import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Mail } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  notes: string;
  lastVisitAt: string | null;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCustomers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Klienci (Mini-CRM)</h2>
          <p className="text-surface-500 mt-1">Zarządzaj swoją bazą kontaktów i tagami.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input 
              type="text" 
              placeholder="Szukaj klienta..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-surface-200 rounded-xl focus:ring-2 focus:ring-gold-500"
            />
          </div>
          <button className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors">
            <Plus className="w-5 h-5" /> Nowy klient
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 shadow-sm border border-surface-200/60 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-surface-500">Ładowanie bazy...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-surface-500">Brak wyników</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-200 text-sm text-surface-500">
                  <th className="py-3 font-medium">Imię i nazwisko</th>
                  <th className="py-3 font-medium">Telefon</th>
                  <th className="py-3 font-medium">Tagi</th>
                  <th className="py-3 font-medium">Ostatnia wizyta</th>
                  <th className="py-3 font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-surface-100 hover:bg-surface-50/50">
                    <td className="py-4 font-medium text-surface-900">{c.name}</td>
                    <td className="py-4 text-surface-600">{c.phone}</td>
                    <td className="py-4">
                      <div className="flex gap-2">
                        {c.tags && c.tags.length > 0 ? c.tags.map((t, idx) => (
                          <span key={idx} className="bg-surface-200 text-surface-700 px-2 py-0.5 rounded text-xs font-medium">{t}</span>
                        )) : <span className="text-surface-400 text-xs italic">Brak tagów</span>}
                      </div>
                    </td>
                    <td className="py-4 text-surface-500 text-sm">
                      {c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString() : 'Brak danych'}
                    </td>
                    <td className="py-4">
                      <button className="text-gold-600 hover:text-gold-700 text-sm font-medium flex items-center gap-1">
                        <Mail className="w-4 h-4" /> Kontakt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
