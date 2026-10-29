import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { 
  Star, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  Phone, 
  Search, 
  AlertCircle,
  Loader2,
  HeartHandshake,
  Upload,
  Smartphone,
  FileText,
  Check,
  X,
  CheckSquare,
  Square,
  Info,
  Sparkles
} from 'lucide-react';
import PageHelpButton from './common/PageHelpButton';
import { 
  parseVCardContent, 
  parseSmartText, 
  normalizePhoneNumber, 
  type ParsedContact 
} from '../utils/vcardParser';

interface VipContact {
  id: string;
  phoneNumber: string;
  contactName: string;
  category: string;
  customNotes?: string | null;
  allowPrioritySlots: boolean;
  formalityLevel?: string;
  createdAt: string;
}

const CATEGORIES = [
  'VIP',
  'Rodzina',
  'Praca',
  'Prywatne',
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
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Stan pojedynczego formularza dodawania/edycji
  const [formData, setFormData] = useState({
    phoneNumber: '',
    contactName: '',
    category: 'VIP',
    customNotes: '',
    allowPrioritySlots: true,
    formalityLevel: 'default'
  });

  // Stany dla modułu importu kontaktów z telefonu
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportChooserOpen, setIsImportChooserOpen] = useState(false);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [bulkCategory, setBulkCategory] = useState<string>('VIP');
  const [bulkPriority, setBulkPriority] = useState<boolean>(true);
  const [importing, setImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isContactPickerSupported = typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

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

  const location = useLocation();

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    if (location.state && (location.state as any).openNewVip) {
      const state = location.state as any;
      setCurrentContact(null);
      setFormData({
        phoneNumber: state.defaultPhone || '',
        contactName: state.defaultName || '',
        category: 'VIP',
        customNotes: '',
        allowPrioritySlots: true,
        formalityLevel: 'default'
      });
      setError('');
      setIsModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const openAddModal = () => {
    setCurrentContact(null);
    setFormData({
      phoneNumber: '',
      contactName: '',
      category: 'VIP',
      customNotes: '',
      allowPrioritySlots: true,
      formalityLevel: 'default'
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
      allowPrioritySlots: contact.allowPrioritySlots,
      formalityLevel: contact.formalityLevel || 'default'
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
      setSuccessToast(currentContact ? 'Zaktualizowano kontakt VIP.' : 'Pomyślnie dodano kontakt VIP.');
      setTimeout(() => setSuccessToast(null), 3000);
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
        setSuccessToast(`Usunięto kontakt: ${name}`);
        setTimeout(() => setSuccessToast(null), 3000);
      }
    } catch (err) {
      alert('Błąd usuwania kontaktu.');
    }
  };

  // 1. Pobieranie z natywnego selektora kontaktów telefonu (Android Contact Picker API)
  const handlePickFromPhone = async () => {
    setIsImportChooserOpen(false);
    try {
      if (!('contacts' in navigator && (navigator as any).contacts?.select)) {
        alert('Natywny selektor kontaktów telefonu jest wspierany w przeglądarkach na telefonach z systemem Android (Chrome, Edge, Samsung Internet).\n\nNa telefonach iPhone użyj opcji "Wgraj plik kontaktów (.vcf)" wyeksportowany z aplikacji Kontakty.');
        return;
      }

      const props = ['name', 'tel'];
      const opts = { multiple: true };
      const picked = await (navigator as any).contacts.select(props, opts);

      if (picked && picked.length > 0) {
        const list: ParsedContact[] = [];
        picked.forEach((item: any, idx: number) => {
          const name = (item.name && item.name[0]) ? item.name[0] : `Kontakt ${idx + 1}`;
          const phones = item.tel || [];
          phones.forEach((p: string, pIdx: number) => {
            const norm = normalizePhoneNumber(p);
            if (norm.replace(/\D/g, '').length >= 8 && !list.some(x => x.phoneNumber === norm)) {
              list.push({
                id: `phone_${idx}_${pIdx}`,
                contactName: name,
                phoneNumber: norm,
                rawPhone: p,
                category: 'VIP',
                allowPrioritySlots: true,
                selected: true
              });
            }
          });
        });

        if (list.length === 0) {
          alert('W wybranych kontaktach nie znaleziono poprawnych numerów telefonów.');
          return;
        }

        setParsedContacts(list);
        setImportError(null);
        setIsImportModalOpen(true);
      }
    } catch (err: any) {
      console.log('Anulowano wybór kontaktów lub błąd API:', err);
    }
  };

  // 2. Import pliku .vcf (vCard) - uniwersalne dla iPhone, Android, PC
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportChooserOpen(false);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      let list = parseVCardContent(text);
      if (list.length === 0) {
        list = parseSmartText(text);
      }

      if (list.length === 0) {
        alert('Nie udało się odnaleźć poprawnych wizytówek ani numerów telefonów w wybranym pliku.');
        return;
      }

      setParsedContacts(list);
      setImportError(null);
      setIsImportModalOpen(true);
      e.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  // 3. Wklejanie tekstu / wizytówki
  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;
    let list = parseVCardContent(pastedText);
    if (list.length === 0) {
      list = parseSmartText(pastedText);
    }

    if (list.length === 0) {
      alert('Nie znaleziono poprawnych numerów w wklejonym tekście.');
      return;
    }

    setParsedContacts(list);
    setShowPasteBox(false);
    setPastedText('');
    setIsImportChooserOpen(false);
    setImportError(null);
    setIsImportModalOpen(true);
  };

  // Zaznaczanie / odznaczanie kontaktów w modalu podglądu
  const toggleSelectContact = (id: string) => {
    setParsedContacts(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };

  const toggleSelectAll = (selectAll: boolean) => {
    setParsedContacts(prev => prev.map(c => ({ ...c, selected: selectAll })));
  };

  const updateContactName = (id: string, newName: string) => {
    setParsedContacts(prev => prev.map(c => c.id === id ? { ...c, contactName: newName } : c));
  };

  const removeContactFromPreview = (id: string) => {
    setParsedContacts(prev => prev.filter(c => c.id !== id));
  };

  // Wykonanie masowego zapisu w backendzie
  const handleExecuteBatchImport = async () => {
    const selected = parsedContacts.filter(c => c.selected);
    if (selected.length === 0) {
      setImportError('Zaznacz co najmniej jeden kontakt do zaimportowania.');
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const payload = selected.map(c => ({
        phoneNumber: c.phoneNumber,
        contactName: c.contactName,
        category: bulkCategory,
        customNotes: c.customNotes || null,
        allowPrioritySlots: bulkPriority
      }));

      const res = await fetch('/api/vip-contacts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: payload })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Błąd masowego zapisu kontaktów.');
      }

      setIsImportModalOpen(false);
      setParsedContacts([]);
      await fetchContacts();

      setSuccessToast(`🎉 Sukces: Zaimportowano ${data.count} kontaktów do Bazy VIP!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setImportError(err.message || 'Wystąpił nieoczekiwany błąd podczas importu.');
    } finally {
      setImporting(false);
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phoneNumber.includes(searchQuery) ||
    c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCount = parsedContacts.filter(c => c.selected).length;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 w-full max-w-full min-w-0">
      
      {/* Toast powiadomienia */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-[10000] bg-surface-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-surface-700 animate-in slide-in-from-bottom-4 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
            ✓
          </div>
          <span className="text-sm font-medium">{successToast}</span>
        </div>
      )}

      {/* Ukryty input pliku vCard */}
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".vcf,text/vcard,text/x-vcard"
        className="hidden"
      />

      {/* Nagłówek */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Kontakty VIP & Baza Bliskich</h2>
            <PageHelpButton
              title="Kontakty z Priorytetem & Baza Bliskich"
              description="Osoby dodane do tej listy są natychmiast rozpoznawane po Caller ID przez Asystenta. Asystent wita je bezpośrednio i ciepło oraz może udostępnić im specjalne sloty priorytetowe."
              tips={[
                "Szybki Import: Nie musisz wpisywać kontaktów ręcznie. Użyj przycisku 'Pobierz z telefonu' (Android) lub wgraj plik .vcf wyeksportowany z kontaktów (iPhone/Android).",
                "Terminy Priorytetowe: Zaznacz 'Udostępnij terminy priorytetowe', aby asystent mógł zaoferować tej osobie najlepsze okienka (niedostępne dla zwykłych dzwoniących).",
                "Live Call Transfer: W przypadku pilnej sprawy od osoby z kategorii VIP lub Rodzina asystent może spróbować bezpośrednio połączyć ją z Twoją komórką (limit 30 sek.; w razie braku odbioru natychmiast przejmuje rozmowę z powrotem).",
                "Baza Wiedzy Poufnej: Pamiętaj, że nawet kontakty z listy VIP nie mają dostępu do wiedzy oznaczonej jako Poufne bez podania kodu PIN."
              ]}
              guideSectionId="personal-call-transfer"
            />
          </div>
          <p className="text-surface-500 mt-1">Zarządzaj kluczowymi klientami, rodziną i zaufanymi partnerami rozpoznawanymi po Caller ID.</p>
        </div>

        {/* Grupa przycisków akcji */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsImportChooserOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-300 font-semibold rounded-xl transition shadow-xs"
          >
            <Smartphone className="w-4 h-4 text-amber-600" />
            <span>Pobierz z telefonu</span>
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md hover:bg-surface-800 hover:text-white transition"
          >
            <Plus className="w-5 h-5" />
            Dodaj Kontakt
          </button>
        </div>
      </div>

      {/* Belka informacyjna VIP */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-300/40 rounded-2xl p-5 flex items-start gap-4">
        <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
          <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
        </div>
        <div>
          <h3 className="font-bold text-surface-900 text-sm">Automatyczne rozpoznawanie i ochrona prywatności (Privacy Shield)</h3>
          <p className="text-xs text-surface-600 mt-1 leading-relaxed">
            Gdy dzwoni osoba z tej listy, Asystentka wita ją ciepło: <em>„Dzień dobry Panie Marku! Przekazać pilną wiadomość czy zarezerwować dogodny termin?”</em>. 
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
            Dodaj najważniejszych klientów, bliskich lub wspólników, aby asystentka traktowała ich priorytetowo. Możesz pobrać ich prosto ze swojego telefonu!
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => setIsImportChooserOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-900 border border-amber-300 text-sm font-semibold rounded-xl hover:bg-amber-500/20 transition"
            >
              <Smartphone className="w-4 h-4 text-amber-600" />
              Pobierz z telefonu
            </button>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface-900 text-white text-sm font-semibold rounded-xl hover:bg-surface-800 transition"
            >
              <Plus className="w-4 h-4" />
              Dodaj ręcznie
            </button>
          </div>
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
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        <span className="inline-block bg-surface-100 text-surface-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                          {c.category}
                        </span>
                        {c.formalityLevel && c.formalityLevel !== 'default' && (
                          <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            {c.formalityLevel === 'direct_ty' ? 'Na Ty' : (c.formalityLevel === 'formal_pan_pani' ? 'Pan/Pani' : 'Uprzejmy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
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

      {/* MODAL 1: Wybór metody pobrania kontaktów */}
      {isImportChooserOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-surface-900/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsImportChooserOpen(false);
            }}
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-6 shadow-2xl border border-surface-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-surface-900">
                      Pobierz kontakty z telefonu
                    </h3>
                    <p className="text-xs text-surface-500">Bezpieczny import w kilka sekund</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsImportChooserOpen(false)}
                  className="p-2 text-surface-400 hover:text-surface-700 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {/* Opcja 1: Natywny selektor Android */}
                <button
                  type="button"
                  onClick={handlePickFromPhone}
                  className="w-full p-4 bg-surface-50 hover:bg-amber-50/70 border border-surface-200 hover:border-amber-300 rounded-2xl transition text-left flex items-start gap-3.5 group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-surface-900 flex items-center gap-2">
                      <span>Wybierz z książki telefonu</span>
                      {isContactPickerSupported && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                          Dostępne
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5">
                      Otwiera systemowe okno Androida. Zaznacz wybrane osoby lub całą listę.
                    </p>
                  </div>
                </button>

                {/* Opcja 2: Uniwersalny plik .vcf (iPhone & Android) */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 bg-surface-50 hover:bg-indigo-50/70 border border-surface-200 hover:border-indigo-300 rounded-2xl transition text-left flex items-start gap-3.5 group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-surface-900 flex items-center gap-2">
                      <span>Wgraj plik kontaktów (.vcf)</span>
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-md">
                        iPhone & Android
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5">
                      W telefonie: <em>Kontakty → Udostępnij / Eksportuj do pliku</em>.
                    </p>
                  </div>
                </button>

                {/* Opcja 3: Wklej tekst / wizytówkę */}
                <button
                  type="button"
                  onClick={() => setShowPasteBox(!showPasteBox)}
                  className="w-full p-4 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-2xl transition text-left flex items-start gap-3.5 group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-surface-200 text-surface-700 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-surface-900">
                      Wklej tekst lub wizytówkę
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5">
                      Wklej treść SMS-a, e-maila lub listę z numerami telefonów.
                    </p>
                  </div>
                </button>

                {/* Pole wklejania tekstu */}
                {showPasteBox && (
                  <div className="p-3.5 bg-surface-50 rounded-2xl border border-surface-200 space-y-2.5 animate-in fade-in duration-150">
                    <textarea
                      rows={3}
                      placeholder="Wklej tutaj np.:&#10;Jan Kowalski +48 501 234 567&#10;Mama: 600100200"
                      value={pastedText}
                      onChange={e => setPastedText(e.target.value)}
                      className="w-full p-2.5 text-xs bg-white border border-surface-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleParsePastedText}
                      disabled={!pastedText.trim()}
                      className="w-full py-2 bg-surface-900 text-white rounded-xl text-xs font-semibold hover:bg-surface-800 disabled:opacity-50 transition"
                    >
                      Przeanalizuj wklejony tekst
                    </button>
                  </div>
                )}
              </div>

              {/* Wskazówka dla użytkowników iPhone */}
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-950 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Dla użytkowników iPhone:</strong> W aplikacji systemowej <em>Kontakty</em> na iPhone zaznacz wybrane osoby (lub wejdź w grupę) i kliknij <em>„Udostępnij kontakty”</em>, a następnie zapisz plik .vcf lub wgraj go tutaj.
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 2: Kwalifikacja i Podgląd Importu */}
      {isImportModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-surface-900/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget && !importing) setIsImportModalOpen(false);
            }}
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-surface-200 max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150">
              
              {/* Nagłówek modalu podglądu */}
              <div className="flex items-center justify-between pb-4 border-b border-surface-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif font-bold text-surface-900">
                      Kwalifikacja i Zapis Kontaktów
                    </h3>
                    <p className="text-xs text-surface-500">
                      Wykryto <strong>{parsedContacts.length}</strong> kontaktów. Zaznacz osoby, które chcesz dodać do Bazy VIP.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  disabled={importing}
                  className="p-2 text-surface-400 hover:text-surface-700 rounded-lg"
                >
                  ✕
                </button>
              </div>

              {importError && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Pasek ustawień zbiorczych */}
              <div className="py-4 grid sm:grid-cols-2 gap-3 border-b border-surface-100">
                <div>
                  <label className="block text-[11px] font-bold text-surface-700 uppercase tracking-wider mb-1">
                    Domyślna Kategoria dla importowanych:
                  </label>
                  <select
                    value={bulkCategory}
                    onChange={e => setBulkCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-primary outline-none"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2.5 p-2 rounded-xl border border-surface-200 cursor-pointer hover:bg-surface-50 transition w-full">
                    <input 
                      type="checkbox"
                      checked={bulkPriority}
                      onChange={e => setBulkPriority(e.target.checked)}
                      className="w-4 h-4 text-primary rounded border-surface-300"
                    />
                    <span className="text-xs font-semibold text-surface-800">
                      Udostępnij Terminy Priorytetowe (VIP)
                    </span>
                  </label>
                </div>
              </div>

              {/* Pasek zaznacz wszystko */}
              <div className="py-2.5 flex items-center justify-between text-xs text-surface-600 bg-surface-50/60 px-3 rounded-xl mt-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(selectedCount !== parsedContacts.length)}
                    className="flex items-center gap-1.5 font-bold text-primary hover:underline"
                  >
                    {selectedCount === parsedContacts.length ? (
                      <>
                        <CheckSquare className="w-4 h-4" /> Odznacz wszystkie
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4" /> Zaznacz wszystkie
                      </>
                    )}
                  </button>
                </div>
                <div>
                  Wybrano: <strong className="text-surface-900">{selectedCount}</strong> z {parsedContacts.length}
                </div>
              </div>

              {/* Lista kontaktów do zatwierdzenia */}
              <div className="flex-1 overflow-y-auto my-3 pr-1 space-y-2 max-h-[48vh]">
                {parsedContacts.map(item => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                      item.selected 
                        ? 'bg-white border-amber-300/80 shadow-2xs' 
                        : 'bg-surface-50/70 border-surface-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelectContact(item.id)}
                        className="text-surface-500 hover:text-primary shrink-0"
                      >
                        {item.selected ? (
                          <CheckSquare className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <input 
                          type="text"
                          value={item.contactName}
                          onChange={e => updateContactName(item.id, e.target.value)}
                          className="w-full text-xs font-bold text-surface-900 bg-transparent border-b border-transparent hover:border-surface-300 focus:border-primary outline-none py-0.5 truncate"
                          title="Kliknij, aby zmienić nazwę kontaktu"
                        />
                        <div className="flex items-center gap-2 text-[11px] text-surface-500 font-mono mt-0.5">
                          <Phone className="w-3 h-3 text-surface-400" />
                          <span>{item.phoneNumber}</span>
                          {item.customNotes && (
                            <span className="text-[10px] bg-surface-100 text-surface-600 px-1.5 rounded truncate">
                              {item.customNotes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeContactFromPreview(item.id)}
                      className="p-1.5 text-surface-400 hover:text-red-500 rounded-lg shrink-0 transition"
                      title="Usuń z listy importu"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Stopka z przyciskami zapisu */}
              <div className="pt-4 border-t border-surface-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  disabled={importing}
                  className="px-4 py-2.5 text-sm text-surface-600 hover:text-surface-900 font-medium"
                >
                  Anuluj
                </button>

                <button
                  type="button"
                  onClick={handleExecuteBatchImport}
                  disabled={importing || selectedCount === 0}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-surface-800 disabled:opacity-50 transition text-sm shadow-md"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Zapisywanie w bazie...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Zapisz w Bazie VIP ({selectedCount})</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>,
          document.body
        )}

      {/* MODAL 3: Ręczne Dodawanie / Edycja Kontaktu */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-surface-900/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsModalOpen(false);
            }}
          >
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-8 shadow-2xl border border-surface-200 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
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
                    Styl zwracania się (Rejestr Językowy)
                  </label>
                  <select
                    value={formData.formalityLevel}
                    onChange={e => setFormData({ ...formData, formalityLevel: e.target.value })}
                    className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
                  >
                    <option value="default">Domyślny (zgodny z profilem asystenta)</option>
                    <option value="formal_pan_pani">Oficjalny (Zawsze per Pan / Pani)</option>
                    <option value="professional_friendly">Profesjonalny i Uprzejmy (Partnerski)</option>
                    <option value="direct_ty">Bezpośredni (Na Ty - rodzina, przyjaciele, koledzy)</option>
                  </select>
                  <p className="text-[11px] text-surface-400 mt-1">
                    Określa, jak asystent ma zwracać się do tego kontaktu podczas rozmowy.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5">
                    Wskazówki dla Asystentki AI (Notatka)
                  </label>
                  <textarea 
                    rows={2}
                    placeholder="np. 'Kluczowy partner z Krakowa. Zawsze traktuj z najwyższym priorytetem i natychmiast powiadamiaj o kontakcie.'"
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
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-surface-800 hover:text-white disabled:opacity-50 transition text-sm shadow"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {currentContact ? 'Zapisz Zmiany' : 'Dodaj Kontakt'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
