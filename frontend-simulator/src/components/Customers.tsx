import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PageHelpButton from './common/PageHelpButton';
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  Tag, 
  Check, 
  X, 
  Trash2, 
  Phone, 
  Headphones, 
  Calendar, 
  Clock, 
  ChevronRight, 
  FileText, 
  Sparkles, 
  Lock, 
  AlertCircle, 
  MessageSquare,
  Save
} from 'lucide-react';
import CopilotCockpitModal from './CopilotCockpitModal';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  notes: string;
  formalityLevel?: string;
  lastVisitAt: string | null;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', tags: '', formalityLevel: 'default' });

  // Stan profilu tenanta i uprawnień
  const [tenant, setTenant] = useState<any>(null);
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    targetPlanName?: string;
  }>({ isOpen: false, title: '', description: '' });

  // Stan modala historii klienta
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerHistory, setCustomerHistory] = useState<{
    customer: Customer;
    appointments: any[];
    callLogs: any[];
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Stan modala Copilot na żywo
  const [copilotModal, setCopilotModal] = useState<{
    isOpen: boolean;
    phone: string;
    name: string;
    customerId?: string;
  }>({ isOpen: false, phone: '', name: '' });

  const fetchTenant = async () => {
    try {
      const res = await fetch('/api/tenant');
      if (res.ok) {
        const data = await res.json();
        setTenant(data);
      }
    } catch (err) {
      console.error('Błąd tenanta:', err);
    }
  };

  const fetchCustomers = () => {
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
  };

  useEffect(() => {
    fetchCustomers();
    fetchTenant();
  }, []);

  const planName = (tenant?.subscription?.planName || '').toLowerCase();
  const isPersonalProfile = tenant?.businessProfile === 'personal' || planName.includes('personal');
  const isPersonalExpert = 
    planName === 'personal_expert' || 
    planName.includes('expert') ||
    ((planName === 'beta_pilot' || planName === 'pilot') && (tenant?.betaNotes || '').includes('Osobisty Ekspert'));
  const isB2B = !isPersonalProfile;
  const canAccessCopilot = isB2B || isPersonalExpert;

  const handleOpenCopilot = (phone: string, name: string, customerId?: string) => {
    if (!canAccessCopilot) {
      setUpgradeModal({
        isOpen: true,
        title: 'Moduł: Copilot Rozmów na Żywo',
        description: 'Inteligentny pomocnik konwersacyjny (podpowiedzi w uchu/na ekranie w trakcie rozmowy telefonicznej, dynamiczna checklista i dostęp do Bazy Wiedzy FAQ) jest dostępny w Pakiecie Osobisty Ekspert oraz pakietach biznesowych B2B.',
        targetPlanName: isPersonalProfile ? 'Pakiet Osobisty Ekspert' : 'Pakiet Premium B2B'
      });
      return;
    }
    setCopilotModal({
      isOpen: true,
      phone,
      name,
      customerId
    });
  };

  const handleOpenHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditingNotes(customer.notes || '');
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setCustomerHistory(data);
      } else {
        setCustomerHistory({ customer, appointments: [], callLogs: [] });
      }
    } catch (err) {
      setCustomerHistory({ customer, appointments: [], callLogs: [] });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedCustomer) return;
    setIsSavingNotes(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editingNotes })
      });
      if (res.ok) {
        toast.success('Notatki zaktualizowane!');
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, notes: editingNotes } : c));
        if (customerHistory) {
          setCustomerHistory({
            ...customerHistory,
            customer: { ...customerHistory.customer, notes: editingNotes }
          });
        }
      } else {
        toast.error('Błąd zapisu notatek.');
      }
    } catch (err) {
      toast.error('Błąd połączenia.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tego klienta?')) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCustomers(prev => prev.filter(c => c.id !== id));
        if (selectedCustomer?.id === id) setSelectedCustomer(null);
        toast.success('Klient usunięty.');
      } else {
        toast.error('Błąd podczas usuwania klienta.');
      }
    } catch (err) {
      toast.error('Błąd połączenia.');
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomerForm.name || !newCustomerForm.phone) {
      toast.error('Imię i numer telefonu są wymagane!');
      return;
    }
    const tagsArray = newCustomerForm.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomerForm.name,
          phone: newCustomerForm.phone,
          tags: tagsArray,
          formalityLevel: newCustomerForm.formalityLevel
        })
      });
      if (res.ok) {
        const added = await res.json();
        setCustomers([added, ...customers]);
        setShowNewModal(false);
        setNewCustomerForm({ name: '', phone: '', tags: '', formalityLevel: 'default' });
        toast.success('Klient dodany!');
      } else {
        toast.error('Błąd dodawania klienta');
      }
    } catch (err) {
      toast.error('Błąd połączenia.');
    }
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-serif text-surface-900 tracking-tight">Klienci / Kartoteka (Mini-CRM)</h2>
            <PageHelpButton
              title="Kartoteka Klientów i Copilot Rozmów"
              description="Zarządzaj bazą kontaktów, historią interakcji, notatkami oraz dzwoń bezpośrednio z pomocą asystenta Copilot na żywo."
              tips={[
                "Copilot na żywo: Kliknij fioletowy przycisk 'Copilot', aby zadzwonić z komputera lub telefonu. Centrala połączy Cię z klientem, prezentując numer techniczny (oddzwonienia klienta trafiają na Twój numer firmowy), a asystent w czasie rzeczywistym podpowiada argumenty z Bazy Wiedzy, cennik i checklistę.",
                "Historia interakcji: Kliknij 'Szczegóły', aby przejrzeć wcześniejsze połączenia, podsumowania AI i historię spotkań.",
                "Poziom formalności per kontakt: Ustaw, czy asystent ma zwracać się do danego klienta oficjalnie (Pan/Pani) czy bezpośrednio na 'Ty'."
              ]}
              guideSectionId="personal-adaptive-roles"
            />
          </div>
          <p className="text-surface-500 mt-1 text-xs sm:text-sm">Zarządzaj kartoteką kontaktów, notatkami i dzwoń z pomocą Copilota.</p>
        </div>

        {/* Kontrolki wyszukiwania i dodawania - w 100% dopasowane do telefonów */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input 
              type="text" 
              placeholder="Szukaj klienta..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-surface-200 rounded-xl focus:ring-2 focus:ring-gold-500 text-sm outline-none shadow-2xs"
            />
          </div>
          <button 
            onClick={() => setShowNewModal(true)} 
            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors text-sm cursor-pointer shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" /> Nowy klient
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-sm border border-surface-200/60 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-surface-500 text-sm">Ładowanie bazy kontaktów...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-surface-500 text-sm">Brak klientów w kartotece. Dodaj pierwszego klienta przyciskiem powyżej.</div>
        ) : (
          <>
            {/* WIDOK MOBILNY: KAFELKI KLIENTÓW (ekrany smartfonów) */}
            <div className="block md:hidden space-y-3">
              {filtered.map(c => (
                <div key={c.id} className="bg-white rounded-2xl p-4 border border-surface-200 shadow-2xs space-y-3">
                  {/* Górny wiersz kafelka */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-serif font-bold text-base text-surface-900">{c.name}</div>
                      <a href={`tel:${c.phone}`} className="text-xs font-mono text-indigo-600 font-semibold hover:underline flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {c.phone}
                      </a>
                    </div>
                    {c.formalityLevel && c.formalityLevel !== 'default' && (
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        {c.formalityLevel === 'direct_ty' ? 'Na Ty' : (c.formalityLevel === 'formal_pan_pani' ? 'Pan/Pani' : 'Uprzejmy')}
                      </span>
                    )}
                  </div>

                  {/* Tagi i data ostatniego kontaktu */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-surface-100">
                    <div className="flex flex-wrap gap-1">
                      {c.tags && c.tags.length > 0 ? c.tags.map((t, idx) => (
                        <span key={idx} className="bg-surface-100 text-surface-700 px-2 py-0.5 rounded-md text-[11px] font-medium border border-surface-200/60">
                          {t}
                        </span>
                      )) : <span className="text-surface-400 text-[11px] italic">Brak tagów</span>}
                    </div>
                    <div className="text-[11px] text-surface-500">
                      {c.lastVisitAt ? `Kontakt: ${new Date(c.lastVisitAt).toLocaleDateString()}` : 'Nowy kontakt'}
                    </div>
                  </div>

                  {/* Treść notatki CRM (jeśli istnieje) */}
                  {c.notes && (
                    <div className="bg-surface-50 p-2.5 rounded-xl border border-surface-200/80 text-xs text-surface-700 leading-relaxed italic">
                      "{c.notes}"
                    </div>
                  )}

                  {/* Przyciski akcji na telefonie */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenCopilot(c.phone, c.name, c.id)}
                      className="col-span-1 py-2 px-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl text-xs transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Headphones className="w-3.5 h-3.5" />
                      Copilot
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenHistory(c)}
                      className="col-span-1 py-2 px-2 bg-surface-100 hover:bg-surface-200 text-surface-800 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer border border-surface-200"
                    >
                      <FileText className="w-3.5 h-3.5 text-surface-600" />
                      Historia
                    </button>
                    <div className="col-span-1 flex items-center gap-1">
                      <a
                        href={`tel:${c.phone}`}
                        className="flex-1 py-2 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1 border border-emerald-200 text-center"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        GSM
                      </a>
                      <button
                        onClick={() => handleDeleteCustomer(c.id)}
                        className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                        title="Usuń"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* WIDOK DESKTOP: PEŁNA TABELA (komputery i tablety) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-200 text-sm text-surface-500">
                    <th className="py-3 font-medium">Imię i nazwisko</th>
                    <th className="py-3 font-medium">Telefon</th>
                    <th className="py-3 font-medium">Tagi</th>
                    <th className="py-3 font-medium">Ostatni kontakt</th>
                    <th className="py-3 font-medium">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-surface-100 hover:bg-surface-50/50 transition">
                      <td className="py-4 font-medium text-surface-900">
                        <div className="font-semibold">{c.name}</div>
                        {c.formalityLevel && c.formalityLevel !== 'default' && (
                          <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5">
                            {c.formalityLevel === 'direct_ty' ? 'Na Ty' : (c.formalityLevel === 'formal_pan_pani' ? 'Pan/Pani' : 'Uprzejmy')}
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-surface-600 font-mono text-sm">{c.phone}</td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-1">
                          {c.tags && c.tags.length > 0 ? c.tags.map((t, idx) => (
                            <span key={idx} className="bg-surface-200 text-surface-700 px-2 py-0.5 rounded text-xs font-medium">{t}</span>
                          )) : <span className="text-surface-400 text-xs italic">Brak tagów</span>}
                        </div>
                      </td>
                      <td className="py-4 text-surface-500 text-sm">
                        {c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString() : 'Brak danych'}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenCopilot(c.phone, c.name, c.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer"
                            title="Zadzwoń z asystentem na żywo"
                          >
                            <Headphones className="w-3.5 h-3.5" />
                            Copilot
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenHistory(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface-100 hover:bg-surface-200 text-surface-700 font-medium rounded-xl text-xs transition cursor-pointer"
                            title="Zobacz historię połączeń i notatki"
                          >
                            <FileText className="w-3.5 h-3.5 text-surface-500" />
                            Historia
                          </button>

                          <a 
                            href={`tel:${c.phone}`} 
                            className="text-surface-500 hover:text-surface-800 p-1.5 rounded-lg hover:bg-surface-100 transition"
                            title="Zwykłe połączenie GSM"
                          >
                            <Phone className="w-4 h-4" />
                          </a>

                          <button 
                            onClick={() => handleDeleteCustomer(c.id)} 
                            className="text-red-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50 cursor-pointer" 
                            title="Usuń klienta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DRAWER / MODAL: HISTORIA INTERAKCJI & NOTATKI KLIENTA */}
      {/* ========================================================================= */}
      {selectedCustomer && (
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedCustomer(null);
            }}
          >
            <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150 space-y-5">
              <button 
                onClick={() => setSelectedCustomer(null)} 
                className="absolute right-4 top-4 text-surface-400 hover:text-surface-700 p-1 rounded-lg cursor-pointer transition-colors"
                title="Zamknij"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8 border-b border-surface-100 pb-4">
                <div>
                  <h3 className="text-xl font-serif font-bold text-surface-900">
                    {selectedCustomer.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-surface-600">{selectedCustomer.phone}</span>
                    {selectedCustomer.formalityLevel && (
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        {selectedCustomer.formalityLevel === 'direct_ty' ? 'Zwracanie się: Na Ty' : 'Zwracanie się: Pan/Pani'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cust = selectedCustomer;
                      setSelectedCustomer(null);
                      handleOpenCopilot(cust.phone, cust.name, cust.id);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl text-xs hover:from-indigo-700 hover:to-purple-700 transition shadow-sm cursor-pointer"
                  >
                    <Headphones className="w-4 h-4" />
                    Zadzwoń z Copilotem
                  </button>
                  <a
                    href={`tel:${selectedCustomer.phone}`}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-100 text-surface-700 font-semibold rounded-xl text-xs hover:bg-surface-200 transition"
                  >
                    <Phone className="w-4 h-4" />
                    GSM
                  </a>
                </div>
              </div>

              {historyLoading ? (
                <div className="text-center py-8 text-surface-400 text-xs">Pobieranie historii połączeń i wizyt...</div>
              ) : (
                <div className="space-y-5">
                  {/* Sekcja: Notatki CRM */}
                  <div className="bg-surface-50 rounded-2xl p-4 border border-surface-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-surface-700">
                      <span>Notatki i ustalenia handlowe:</span>
                      <button
                        type="button"
                        onClick={handleSaveNotes}
                        disabled={isSavingNotes}
                        className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSavingNotes ? 'Zapisuję...' : 'Zapisz notatkę'}
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={editingNotes}
                      onChange={e => setEditingNotes(e.target.value)}
                      placeholder="Wpisz ustalenia z klientem, preferencje, rabaty lub zadania do wykonania..."
                      className="w-full bg-white border border-surface-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                    />
                  </div>

                  {/* Sekcja: Historia połączeń */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Historia połączeń telefonicznych ({customerHistory?.callLogs?.length || 0}):
                    </h4>
                    {(!customerHistory?.callLogs || customerHistory.callLogs.length === 0) ? (
                      <div className="text-xs text-surface-400 italic bg-surface-50 p-3 rounded-xl border border-surface-100">
                        Brak zarejestrowanych połączeń z tego numeru.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {customerHistory.callLogs.map(log => (
                          <div key={log.id} className="bg-surface-50 p-3 rounded-xl border border-surface-200 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-surface-500">
                              <span>{new Date(log.createdAt).toLocaleString('pl-PL')} ({log.durationSeconds}s)</span>
                              <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                                log.urgency === 'HIGH' || log.urgency === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-surface-200 text-surface-700'
                              }`}>
                                {log.urgency}
                              </span>
                            </div>
                            {log.summary && (
                              <p className="text-surface-800 leading-relaxed font-medium">
                                {log.summary}
                              </p>
                            )}
                            {log.actionItems && (
                              <div className="text-primary font-semibold text-[11px]">
                                🎯 {log.actionItems}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sekcja: Wizyty / Spotkania */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-2 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Spotkania i wizyty w kalendarzu ({customerHistory?.appointments?.length || 0}):
                    </h4>
                    {(!customerHistory?.appointments || customerHistory.appointments.length === 0) ? (
                      <div className="text-xs text-surface-400 italic bg-surface-50 p-3 rounded-xl border border-surface-100">
                        Brak zaplanowanych spotkań.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {customerHistory.appointments.map(app => (
                          <div key={app.id} className="bg-surface-50 p-3 rounded-xl border border-surface-200 text-xs flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-surface-900">{app.service?.name || 'Spotkanie'}</div>
                              <div className="text-[11px] text-surface-500">
                                {new Date(app.startTime).toLocaleString('pl-PL')}
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              app.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-200 text-surface-600'
                            }`}>
                              {app.status === 'confirmed' ? 'Potwierdzone' : app.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOWY KLIENT */}
      {/* ========================================================================= */}
      {showNewModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowNewModal(false);
            }}
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl relative max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
              <button 
                onClick={() => setShowNewModal(false)} 
                className="absolute right-4 top-4 text-surface-400 hover:text-surface-700 p-1 rounded-lg cursor-pointer transition-colors"
                title="Zamknij"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-serif text-surface-900 mb-6">Nowy klient</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Imię i nazwisko</label>
                  <input 
                    type="text" 
                    value={newCustomerForm.name}
                    onChange={e => setNewCustomerForm({...newCustomerForm, name: e.target.value})}
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-gold-500 text-sm outline-none"
                    placeholder="np. Jan Kowalski"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Telefon</label>
                  <input 
                    type="text" 
                    value={newCustomerForm.phone}
                    onChange={e => setNewCustomerForm({...newCustomerForm, phone: e.target.value})}
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-gold-500 text-sm outline-none"
                    placeholder="np. 500123456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Styl zwracania się (Rejestr Językowy)</label>
                  <select
                    value={newCustomerForm.formalityLevel}
                    onChange={e => setNewCustomerForm({...newCustomerForm, formalityLevel: e.target.value})}
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-gold-500 text-sm outline-none"
                  >
                    <option value="default">Domyślny (zgodny z profilem asystenta)</option>
                    <option value="formal_pan_pani">Oficjalny (Zawsze per Pan / Pani)</option>
                    <option value="professional_friendly">Profesjonalny i Uprzejmy (Partnerski)</option>
                    <option value="direct_ty">Bezpośredni (Na Ty - stały klient, znajomy)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Tagi (oddziel przecinkami)</label>
                  <input 
                    type="text" 
                    value={newCustomerForm.tags}
                    onChange={e => setNewCustomerForm({...newCustomerForm, tags: e.target.value})}
                    className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-gold-500 text-sm outline-none"
                    placeholder="np. VIP, oferta, polecenie"
                  />
                </div>
                <button 
                  onClick={handleAddCustomer}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium hover:bg-surface-800 hover:text-white transition-colors mt-2 cursor-pointer text-sm"
                >
                  Zapisz klienta
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* MODAL: COPILOT ROZMÓW NA ŻYWO (COCKPIT) */}
      {/* ========================================================================= */}
      <CopilotCockpitModal
        isOpen={copilotModal.isOpen}
        onClose={() => setCopilotModal({ isOpen: false, phone: '', name: '' })}
        customerPhone={copilotModal.phone}
        customerName={copilotModal.name}
        customerId={copilotModal.customerId}
      />

      {/* ========================================================================= */}
      {/* MODAL: UPGRADE DO PAKIETU OSOBISTY EKSPERT / PREMIUM B2B */}
      {/* ========================================================================= */}
      {upgradeModal.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-surface-950/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-surface-100 overflow-hidden animate-scale-in">
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-200 mb-2 inline-block">
                  {upgradeModal.targetPlanName || 'Wymagany Pakiet Osobisty Ekspert'}
                </span>
                <h3 className="text-base font-bold text-surface-900 mt-2 mb-2">
                  {upgradeModal.title}
                </h3>
                <p className="text-xs text-surface-600 mb-6 leading-relaxed">
                  {upgradeModal.description}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setUpgradeModal({ isOpen: false, title: '', description: '' })}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-surface-200 text-surface-700 font-semibold text-xs hover:bg-surface-50 transition cursor-pointer"
                  >
                    Zamknij
                  </button>
                  <a
                    href="/dashboard/subscription"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    Przejdź na {upgradeModal.targetPlanName || 'Osobisty Ekspert'}
                  </a>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

    </div>
  );
}
