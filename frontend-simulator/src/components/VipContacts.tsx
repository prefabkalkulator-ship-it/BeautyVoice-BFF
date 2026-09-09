import React, { useState, useEffect } from 'react';
import { 
  Star, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  Phone, 
  User, 
  Search, 
  AlertCircle,
  Loader2,
  Lock,
  HeartHandshake
} from 'lucide-react';
import PageHelpButton from './common/PageHelpButton';

interface VipContact {
  id: string;
  phoneNumber: string;
  contactName: string;
  category: string;
  customNotes?: string | null;
  allowPrioritySlots: boolean;
  createdAt: string;
}

const CATEGORIES = [
  'Klient VIP',
  'Rodzina',
  'Przyjaciel',
  'Partner Biznesowy',
  'Kancelaria / Prawnik',
  'Urząd / Księgowość',
  'Inne'
];

export default function VipContacts() {
  const [contacts, setContacts] = useState<VipContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<VipContact | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    phoneNumber: '',
    contactName: '',
    category: 'Klient VIP',
    customNotes: '',
    allowPrioritySlots: true
  });

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/vip-contacts');
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (err) {
      console.error('Błąd pobierania kontaktów VIP:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const openAddModal = () => {
    setCurrentContact(null);
    setFormData({
      phoneNumber: '',
      contactName: '',
      category: 'Klient VIP',
      customNotes: '',
      allowPrioritySlots: true
    });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (contact: VipContact) => {
    setCurrentContact(contact);
    setFormData({
      phoneNumber: contact.phoneNumber,
      contactName: contact.contactName,
      category: contact.category,
      customNotes: contact.customNotes || '',
      allowPrioritySlots: contact.allowPrioritySlots
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contactName.trim() || !formData.phoneNumber.trim()) {
      setError('Wprowadź imię/nazwisko oraz numer telefonu.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = currentContact ? `/api/vip-contacts/${currentContact.id}` : '/api/vip-contacts';
      const method = currentContact ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Błąd zapisu kontaktu VIP.');
      }

      setIsModalOpen(false);
      await fetchContacts();
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć kontakt VIP: ${name}?`)) return;

    try {
      const res = await fetch(`/api/vip-contacts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setContacts(prev => prev.filter(c => c.id !== id));
      }
    } catch (err) {
      alert('Błąd usuwania kontaktu.');
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phoneNumber.includes(searchQuery) ||
    c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Kontakty VIP & Baza Bliskich</h2>
            <PageHelpButton
              title="Zarządzanie Kontaktami VIP"
              description="Osoby dodane do listy VIP są natychmiast rozpoznawane po Caller ID przez Asystenta. Asystent wita je po imieniu, używa ciepłego i bezpośredniego tonu oraz może proponować zarezerwowane dla nich sloty priorytetowe."
              tips={[
                "Wpisz numer z numerem kierunkowym np. +48 600 111 222 (system automatycznie formatuje).",
                "W polu 'Notatki dla Asystentki' wpisz np. 'Zawsze łącz z tym klientem' lub 'Mój najważniejszy partner biznesowy' — Eva uwzględni to w rozmowie.",
                "Zaznacz 'Terminy priorytetowe', aby asystentka mogła udostępnić dla tej osoby godziny niedostępne dla zwykłych dzwoniących."
              ]}
              guideSectionId="vip-contacts"
            />
          </div>
          <p className="text-surface-500 mt-1">Zarządzaj kluczowymi klientami, rodziną i zaufanymi partnerami rozpoznawanymi po Caller ID.</p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md hover:bg-surface-800 transition"
        >
          <Plus className="w-5 h-5" />
          Dodaj Kontakt VIP
        </button>
      </div>

      {/* Belka informacyjna VIP */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-300/40 rounded-2xl p-5 flex items-start gap-4">
        <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
          <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
        </div>
        <div>
          <h3 className="font-bold text-surface-900 text-sm">Automatyczne rozpoznawanie i ochrona prywatności (Privacy Shield)</h3>
          <p className="text-xs text-surface-600 mt-1 leading-relaxed">
            Gdy dzwoni osoba z tej listy, Asystentka wita ją ciepło: <em>„Dzień dobry Panie Marku! Przekazać Panu Mecenasowi pilną wiadomość czy zarezerwować dogodny termin?”</em>. 
            Zwykli dzwoniący (nie-VIP) podlegają ścisłej ochronie prywatności — asystentka nigdy nie ujawnia im Twoich prywatnych planów.
          </p>
        </div>
      </div>

      {/* Wyszukiwarka */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input 
          type="text"
          placeholder="Szukaj po nazwisku, numerze lub kategorii..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
        />
      </div>

      {/* Lista Kontaktów */}
      {loading ? (
        <div className="py-12 text-center text-surface-400 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm">Ładowanie kontaktów VIP...</span>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-surface-200">
          <div className="w-16 h-16 rounded-2xl bg-surface-50 text-surface-400 flex items-center justify-center mx-auto mb-4">
            <HeartHandshake className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-serif font-bold text-surface-900">Brak kontaktów VIP</h3>
          <p className="text-sm text-surface-500 max-w-md mx-auto mt-1 mb-6">
            Dodaj najważniejszych klientów, bliskich lub wspólników, aby asystentka traktowała ich priorytetowo.
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-900 text-white text-sm font-semibold rounded-xl hover:bg-surface-800 transition"
          >
            <Plus className="w-4 h-4" />
            Dodaj pierwszy kontakt
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredContacts.map(c => (
            <div 
              key={c.id}
              className="bg-white rounded-2xl p-5 border border-surface-200/80 shadow-sm hover:shadow-md hover:border-amber-300 transition flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-base border border-amber-200/60">
                      {c.contactName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-surface-900 text-base leading-snug">{c.contactName}</h4>
                      <span className="inline-block bg-surface-100 text-surface-700 text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5">
                        {c.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => openEditModal(c)}
                      className="p-1.5 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg transition"
                      title="Edytuj"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.contactName)}
                      className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Usuń"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mt-4 text-xs text-surface-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    <a href={`tel:${c.phoneNumber}`} className="font-mono text-primary font-semibold hover:underline">
                      {c.phoneNumber}
                    </a>
                  </div>

                  {c.allowPrioritySlots && (
                    <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-medium text-[11px]">Dostęp do terminów priorytetowych</span>
                    </div>
                  )}

                  {c.customNotes && (
                    <div className="bg-surface-50 p-2.5 rounded-xl border border-surface-100 mt-2 text-surface-700 italic">
                      "{c.customNotes}"
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-surface-100 flex items-center justify-between text-[11px] text-surface-400">
                <span>Dodano: {new Date(c.createdAt).toLocaleDateString('pl-PL')}</span>
                <span className="text-amber-600 font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-500" /> VIP
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dodawania / Edycji Kontaktu */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-surface-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Star className="w-5 h-5 fill-amber-500" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-bold text-surface-900">
                    {currentContact ? 'Edytuj Kontakt VIP' : 'Nowy Kontakt VIP'}
                  </h3>
                  <p className="text-xs text-surface-500">Asystentka natychmiast rozpozna ten numer.</p>
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5">
                  Imię i Nazwisko / Nazwa Kontaktu *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="np. Mec. Janusz Kowalski"
                  value={formData.contactName}
                  onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5">
                  Numer Telefonu *
                </label>
                <input 
                  type="tel"
                  required
                  placeholder="np. +48 600 111 222 lub 600111222"
                  value={formData.phoneNumber}
                  onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5">
                  Kategoria Relacji
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5">
                  Wskazówki dla Asystentki AI (Notatka)
                </label>
                <textarea 
                  rows={2}
                  placeholder="np. 'Kluczowy klient z Krakowa. Zawsze łącz lub natychmiast notuj szczegóły sprawy.'"
                  value={formData.customNotes}
                  onChange={e => setFormData({ ...formData, customNotes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
                <p className="text-[11px] text-surface-400 mt-1">
                  Asystentka otrzyma tę instrukcję natychmiast po odebraniu telefonu od tej osoby.
                </p>
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-surface-200 cursor-pointer hover:bg-surface-50 transition">
                  <input 
                    type="checkbox"
                    checked={formData.allowPrioritySlots}
                    onChange={e => setFormData({ ...formData, allowPrioritySlots: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-primary rounded border-surface-300"
                  />
                  <div>
                    <div className="text-xs font-bold text-surface-900">Udostępnij Terminy Priorytetowe</div>
                    <div className="text-[11px] text-surface-500">
                      Pozwól asystentce rezerwować dla tej osoby sloty oznaczone jako VIP, nawet w godzinach niedostępnych dla zwykłych klientów.
                    </div>
                  </div>
                </label>
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
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-surface-800 disabled:opacity-50 transition text-sm shadow"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {currentContact ? 'Zapisz Zmiany' : 'Dodaj Kontakt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
