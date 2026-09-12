import PageHelpButton from './common/PageHelpButton';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Save, Plus, X, User, Briefcase, Home, Moon, Zap, Clock, GraduationCap, Trash2, Copy, RotateCcw, Lock } from 'lucide-react';

const defaultSchedule = {
  "1": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "2": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "3": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "4": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "5": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "6": { "isWorking": false, "start": "10:00", "end": "14:00" },
  "0": { "isWorking": false, "start": "10:00", "end": "14:00" }
};

const DEFAULT_PERSONAL_DAYS: Record<string, {
  workEnabled: boolean;
  workStart: string;
  workEnd: string;
  privateEnabled: boolean;
  privateStart: string;
  privateEnd: string;
}> = {
  "1": { workEnabled: true, workStart: "08:00", workEnd: "16:00", privateEnabled: true, privateStart: "16:00", privateEnd: "20:00" },
  "2": { workEnabled: true, workStart: "08:00", workEnd: "16:00", privateEnabled: true, privateStart: "16:00", privateEnd: "20:00" },
  "3": { workEnabled: true, workStart: "08:00", workEnd: "16:00", privateEnabled: true, privateStart: "16:00", privateEnd: "20:00" },
  "4": { workEnabled: true, workStart: "08:00", workEnd: "16:00", privateEnabled: true, privateStart: "16:00", privateEnd: "20:00" },
  "5": { workEnabled: true, workStart: "08:00", workEnd: "16:00", privateEnabled: true, privateStart: "16:00", privateEnd: "20:00" },
  "6": { workEnabled: false, workStart: "08:00", workEnd: "16:00", privateEnabled: true, privateStart: "10:00", privateEnd: "20:00" },
  "0": { workEnabled: false, workStart: "08:00", workEnd: "16:00", privateEnabled: true, privateStart: "12:00", privateEnd: "18:00" }
};

const SCHEDULE_DAYS = [
  { id: "1", label: "Poniedziałek", short: "Pn" },
  { id: "2", label: "Wtorek", short: "Wt" },
  { id: "3", label: "Środa", short: "Śr" },
  { id: "4", label: "Czwartek", short: "Cz" },
  { id: "5", label: "Piątek", short: "Pt" },
  { id: "6", label: "Sobota", short: "Sb" },
  { id: "0", label: "Niedziela", short: "Nd" }
];

const getOwnerGenitive = (fullName: string, gender: string) => {
  const firstName = fullName ? fullName.trim().split(' ')[0] : '';
  if (!firstName) return gender === 'FEMALE' ? 'Anny' : 'Jana';
  if (gender === 'FEMALE') {
    if (firstName.endsWith('a')) return firstName.slice(0, -1) + 'y';
    return firstName;
  }
  // Męskie
  if (firstName.endsWith('r') || firstName.endsWith('n') || firstName.endsWith('l') || firstName.endsWith('k') || firstName.endsWith('t') || firstName.endsWith('d') || firstName.endsWith('m') || firstName.endsWith('b') || firstName.endsWith('p')) {
    return firstName + 'a';
  }
  return firstName;
};

const getOwnerNominative = (fullName: string, gender: string) => {
  const firstName = fullName ? fullName.trim().split(' ')[0] : '';
  if (!firstName) return gender === 'FEMALE' ? 'Anna' : 'Jan';
  return firstName;
};

export default function Settings() {
  const [tenant, setTenant] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [businessProfile, setBusinessProfile] = useState('solo');
  const [bookingMode, setBookingMode] = useState('hourly');
  const [aiVoice, setAiVoice] = useState('Aoede');
  const [botName, setBotName] = useState('Ewa');
  const [reviewLink, setReviewLink] = useState('');
  const [reviewLink1, setReviewLink1] = useState('');
  const [reviewLink2, setReviewLink2] = useState('');
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [toneOfVoice, setToneOfVoice] = useState('profesjonalny i przyjazny');
  const [proactiveMode, setProactiveMode] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [emailPublicForAi, setEmailPublicForAi] = useState(false);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [ownerName, setOwnerName] = useState('');
  const [ownerGender, setOwnerGender] = useState('MALE');
  const [companyName, setCompanyName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [assistantRole, setAssistantRole] = useState('executive_gatekeeper');
  const [defaultFormalityLevel, setDefaultFormalityLevel] = useState('formal_pan_pani');
  const [profession, setProfession] = useState('');
  const [bioSummary, setBioSummary] = useState('');
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [ownerRequirePin, setOwnerRequirePin] = useState(false);
  const [pinCode, setPinCode] = useState('7777');
  const [confidentialPin, setConfidentialPin] = useState('7777');
  const [morningBriefingEnabled, setMorningBriefingEnabled] = useState(true);
  const [morningBriefingHour, setMorningBriefingHour] = useState(8);
  const [personalSchedule, setPersonalSchedule] = useState({
    workStart: '08:00',
    workEnd: '16:00',
    workDays: [1, 2, 3, 4, 5],
    privateStart: '16:00',
    privateEnd: '20:00',
    privateDays: [1, 2, 3, 4, 5, 6],
    days: JSON.parse(JSON.stringify(DEFAULT_PERSONAL_DAYS)),
    prioritySlots: [] as { day: number; time: string }[],
    nightProtection: true,
    focusBlocks: [] as Array<{ 
      id: string; 
      name: string; 
      days: number[]; 
      start: string; 
      end: string;
      perDayEnabled?: boolean;
      dayTimes?: Record<string | number, { start: string; end: string }>;
    }>
  });

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
        setBotName(tData.botName !== undefined && tData.botName !== null ? tData.botName : 'Ewa');
        setToneOfVoice(tData.toneOfVoice || 'profesjonalny i przyjazny');
        setProactiveMode(Boolean(tData.proactiveMode));
        setReviewLink1(tData.reviewLink1 || '');
        setReviewLink2(tData.reviewLink2 || '');
        setContactEmail(tData.contactEmail || '');
        setEmailPublicForAi(tData.emailPublicForAi || false);
        setAssignedPhoneNumber(tData.assignedPhoneNumber || '');

        setOwnerName(tData.ownerName || tData.name || '');
        setOwnerGender(tData.ownerGender || 'MALE');
        setCompanyName(tData.companyName || (tData.businessProfile !== 'personal' ? tData.name : '') || '');
        setBusinessCategory(tData.businessCategory || '');
        setAssistantRole(tData.assistantRole || (tData.businessProfile === 'personal' ? 'executive_gatekeeper' : 'receptionist'));
        setDefaultFormalityLevel(tData.defaultFormalityLevel || 'formal_pan_pani');
        setProfession(tData.profession || '');
        setBioSummary(tData.bioSummary || '');
        setBufferMinutes(tData.bufferMinutes ?? 15);
        setOwnerRequirePin(tData.ownerRequirePin ?? false);
        setPinCode(tData.pinCode || '7777');
        setConfidentialPin(tData.confidentialPin || '7777');
        setMorningBriefingEnabled(tData.morningBriefingEnabled ?? true);
        setMorningBriefingHour(tData.morningBriefingHour ?? 8);
        if (tData.personalSchedule) {
          setPersonalSchedule(prev => ({ 
            ...prev, 
            ...tData.personalSchedule,
            days: {
              ...DEFAULT_PERSONAL_DAYS,
              ...(tData.personalSchedule.days || {})
            },
            focusBlocks: Array.isArray(tData.personalSchedule.focusBlocks) ? tData.personalSchedule.focusBlocks : []
          }));
        }
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
          body: JSON.stringify({ 
            name: businessProfile === 'personal' ? ownerName : (companyName || ownerName),
            businessProfile, 
            aiVoice, 
            bookingMode, 
            botName, 
            toneOfVoice, 
            proactiveMode,
            reviewLink1, 
            reviewLink2, 
            contactEmail, 
            emailPublicForAi,
            profession,
            bioSummary,
            bufferMinutes,
            ownerRequirePin,
            pinCode,
            confidentialPin,
            morningBriefingEnabled,
            morningBriefingHour,
            personalSchedule,
            ownerName,
            ownerGender,
            companyName,
            businessCategory,
            assistantRole,
            defaultFormalityLevel
          })
        });
      alert('Zapisano ustawienia.');
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

  const DAY_LABELS = [
    { id: 1, label: 'Pn' },
    { id: 2, label: 'Wt' },
    { id: 3, label: 'Śr' },
    { id: 4, label: 'Cz' },
    { id: 5, label: 'Pt' },
    { id: 6, label: 'Sb' },
    { id: 0, label: 'Nd' }
  ];

  const toggleWorkDay = (day: number) => {
    setPersonalSchedule(prev => {
      const days = prev.workDays.includes(day)
        ? prev.workDays.filter(d => d !== day)
        : [...prev.workDays, day];
      return { ...prev, workDays: days };
    });
  };

  const togglePrivateDay = (day: number) => {
    setPersonalSchedule(prev => {
      const days = prev.privateDays.includes(day)
        ? prev.privateDays.filter(d => d !== day)
        : [...prev.privateDays, day];
      return { ...prev, privateDays: days };
    });
  };

  const setStandardSchedule = () => {
    const defaultDays = JSON.parse(JSON.stringify(DEFAULT_PERSONAL_DAYS));
    setPersonalSchedule(prev => ({
      ...prev,
      workStart: '08:00',
      workEnd: '16:00',
      workDays: [1, 2, 3, 4, 5],
      privateStart: '16:00',
      privateEnd: '20:00',
      privateDays: [1, 2, 3, 4, 5, 6, 0],
      days: defaultDays
    }));
  };

  const copyMondayToWeekdays = () => {
    setPersonalSchedule(prev => {
      const currentDays = prev.days || DEFAULT_PERSONAL_DAYS;
      const mondayConf = currentDays["1"] || DEFAULT_PERSONAL_DAYS["1"];
      const newDays = { ...currentDays };
      ["2", "3", "4", "5"].forEach(d => {
        newDays[d] = { ...mondayConf };
      });
      const workDays = Object.entries(newDays).filter(([_, conf]: any) => conf.workEnabled).map(([k]) => parseInt(k, 10));
      const privateDays = Object.entries(newDays).filter(([_, conf]: any) => conf.privateEnabled).map(([k]) => parseInt(k, 10));
      return {
        ...prev,
        days: newDays,
        workDays,
        privateDays
      };
    });
  };

  const updateDaySchedule = (dayId: string, updates: Partial<{
    workEnabled: boolean;
    workStart: string;
    workEnd: string;
    privateEnabled: boolean;
    privateStart: string;
    privateEnd: string;
  }>) => {
    setPersonalSchedule(prev => {
      const currentDays = prev.days || DEFAULT_PERSONAL_DAYS;
      const dayConf = currentDays[dayId] || DEFAULT_PERSONAL_DAYS[dayId] || {
        workEnabled: true,
        workStart: "08:00",
        workEnd: "16:00",
        privateEnabled: true,
        privateStart: "16:00",
        privateEnd: "20:00"
      };
      const updatedDays = {
        ...currentDays,
        [dayId]: { ...dayConf, ...updates }
      };
      const workDays = Object.entries(updatedDays).filter(([_, conf]: any) => conf.workEnabled).map(([k]) => parseInt(k, 10));
      const privateDays = Object.entries(updatedDays).filter(([_, conf]: any) => conf.privateEnabled).map(([k]) => parseInt(k, 10));
      return {
        ...prev,
        days: updatedDays,
        workDays,
        privateDays
      };
    });
  };

  const addFocusBlock = () => {
    const newBlock = {
      id: Date.now().toString(),
      name: 'Lekcje / Czas Skupienia',
      days: [1, 2, 3, 4, 5],
      start: '10:00',
      end: '12:00'
    };
    setPersonalSchedule(prev => ({
      ...prev,
      focusBlocks: [...(prev.focusBlocks || []), newBlock]
    }));
  };

  const removeFocusBlock = (id: string) => {
    setPersonalSchedule(prev => ({
      ...prev,
      focusBlocks: (prev.focusBlocks || []).filter(b => b.id !== id)
    }));
  };

  const updateFocusBlock = (id: string, updates: Partial<{ name: string; days: number[]; start: string; end: string }>) => {
    setPersonalSchedule(prev => ({
      ...prev,
      focusBlocks: (prev.focusBlocks || []).map(b => b.id === id ? { ...b, ...updates } : b)
    }));
  };

  const toggleFocusBlockDay = (id: string, day: number) => {
    setPersonalSchedule(prev => ({
      ...prev,
      focusBlocks: (prev.focusBlocks || []).map(b => {
        if (b.id !== id) return b;
        const days = b.days.includes(day)
          ? b.days.filter(d => d !== day)
          : [...b.days, day];
        return { ...b, days };
      })
    }));
  };

  const toggleFocusBlockPerDay = (id: string) => {
    setPersonalSchedule(prev => ({
      ...prev,
      focusBlocks: (prev.focusBlocks || []).map(b => {
        if (b.id !== id) return b;
        const willEnable = !b.perDayEnabled;
        const dayTimes: Record<string, { start: string; end: string }> = { ...(b.dayTimes as any || {}) };
        if (willEnable) {
          b.days.forEach(d => {
            if (!dayTimes[d]) {
              dayTimes[d] = { start: b.start || '10:00', end: b.end || '12:00' };
            }
          });
        }
        return { ...b, perDayEnabled: willEnable, dayTimes };
      })
    }));
  };

  const updateFocusBlockDayTime = (id: string, day: number, field: 'start' | 'end', val: string) => {
    setPersonalSchedule(prev => ({
      ...prev,
      focusBlocks: (prev.focusBlocks || []).map(b => {
        if (b.id !== id) return b;
        const dayTimes: Record<string, { start: string; end: string }> = { ...(b.dayTimes as any || {}) };
        const current = dayTimes[day] || { start: b.start || '10:00', end: b.end || '12:00' };
        dayTimes[day] = { ...current, [field]: val };
        return { ...b, dayTimes };
      })
    }));
  };

  const copyMondayToWorkdays = (id: string) => {
    setPersonalSchedule(prev => ({
      ...prev,
      focusBlocks: (prev.focusBlocks || []).map(b => {
        if (b.id !== id) return b;
        const dayTimes: Record<string, { start: string; end: string }> = { ...(b.dayTimes as any || {}) };
        const monday = dayTimes[1] || { start: b.start || '10:00', end: b.end || '12:00' };
        [1, 2, 3, 4, 5].forEach(d => {
          if (b.days.includes(d)) {
            dayTimes[d] = { start: monday.start, end: monday.end };
          }
        });
        return { ...b, dayTimes };
      })
    }));
  };

  if (loading) return <div className="p-8">Ładowanie...</div>;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 w-full max-w-full min-w-0">
      <div>
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap sm:flex-nowrap">
          <h2 className="text-2xl sm:text-3xl font-serif text-surface-900 tracking-tight break-words">
            {businessProfile === 'personal' ? 'Ustawienia Asystenta' : 'Ustawienia Firmy'}
          </h2>
          {businessProfile === 'personal' ? (
            <PageHelpButton
              title="Konfiguracja Asystenta Osobistego"
              description="Dostosuj wiedzę o sobie, swój zawód, Czas Skupienia, kody PIN oraz godzinę porannego raportu Push."
              tips={[
                "Profil & Styl Pracy: Wpisz swój zawód i notatkę O mnie – asystent adaptuje się w locie jako doradca handlowy lub deeskalacja, zawsze chroniąc Twoje nazwisko.",
                "PIN Właściciela: Zaznacz 'Wymagaj PIN przy połączeniu...' i ustal kod, aby chronić Tryb Właściciela przed dostępem osób trzecich.",
                "Baza Wiedzy Poufnej (PIN): Skonfiguruj niezależny kod PIN (domyślnie 7777), który chroni wpisy Q&A oznaczone jako Poufne.",
                "Czas Skupienia & Lekcji: Zdefiniuj stałe godziny zajęć i Deep Work – asystent bezwzględnie zablokuje kalendarz w tych oknach.",
                "Poranny Raport Push: Wybierz godzinę wysyłki codziennego podsumowania spotkań, rocznic i spraw pilnych na Twój smartfon."
              ]}
              guideSectionId="personal-owner-mode"
            />
          ) : (
            <PageHelpButton
              title="Konfiguracja Firmy i Zespołu"
              description="Tutaj ustalisz dane firmy, profil działalności oraz dodasz pracowników świadczących usługi."
              tips={[
                "Najważniejsze: zdefiniuj usługi w zakładce 'Usługi' PRZED dodawaniem pracowników, aby móc przypisać im zabiegi!",
                "Godziny pracy Twojej firmy wynikają bezpośrednio z indywidualnych grafików pracy pracowników ustawianych w oknie 'Edytuj pracownika' – asystent proponuje terminy od godziny rozpoczęcia pracy najwcześniejszego pracownika do zakończenia najpóźniejszego.",
                "Jeśli działasz jednoosobowo, wybierz profil 'Solo'. Jeśli masz pracowników, wybierz 'Zespół'."
              ]}
              nextStepRecommendation={{
                text: "Ustaw dni wolne i święta",
                path: "/dashboard/timeoff",
                actionLabel: "Przejdź do Dni Wolnych"
              }}
              guideSectionId="team-assignment"
            />
          )}
        </div>
        <p className="text-surface-500 mt-1 text-xs sm:text-sm">
          {businessProfile === 'personal' 
            ? 'Konfiguruj profil osobisty i preferencje asystenta.' 
            : 'Konfiguruj profil działalności i zespół pracowników.'}
        </p>
      </div>

      <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-sm border border-surface-200/60">
        <h3 className="text-xl font-serif text-surface-900 mb-4">
          {businessProfile === 'personal' ? 'Profil Asystenta' : 'Profil Biznesowy'}
        </h3>

        {businessProfile === 'personal' ? (
          <div className="mb-6 p-3.5 sm:p-4 rounded-xl border-2 border-indigo-600 bg-indigo-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-surface-900 text-sm">Osobisty Asystent AI (Executive)</span>
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[11px] font-bold rounded-full uppercase tracking-wider">
                  Pakiet Osobisty
                </span>
              </div>
              <div className="text-xs text-surface-500 mt-1 leading-relaxed">
                Dedykowany dla osób prywatnych, prawników, lekarzy, architektów, konsultantów i menedżerów. Profile firmowe są zablokowane w tym pakiecie.
              </div>
            </div>
            <span className="text-xs font-medium text-indigo-600 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 self-start sm:self-auto shrink-0 shadow-xs whitespace-nowrap">
              Aktywny w Pakiecie Osobistym
            </span>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Nazwa Firmy / Obiektu *
                </label>
                <input 
                  type="text" 
                  value={companyName} 
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="np. Salon Urody Glamour, Studio Architektury"
                  className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary text-sm bg-white font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Branża / Profil działalności
                </label>
                <input 
                  type="text" 
                  value={businessCategory} 
                  onChange={e => setBusinessCategory(e.target.value)}
                  placeholder="np. Kosmetologia, Architektura i Budownictwo"
                  className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary text-sm bg-white font-medium"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: 'solo', title: 'Solo (Przedsiębiorca)', desc: 'Jeden kalendarz główny, jeden usługodawca.' },
                { id: 'team', title: 'Zespół (Firma)', desc: 'Wielu pracowników świadczących różne usługi.' },
                { id: 'facility', title: 'Obiekty', desc: 'Rezerwacja gabinetów lub zasobów bez pracownika.' }
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
          </div>
        )}

        {businessProfile === 'personal' && (
          <div className="mb-8 p-3.5 sm:p-5 bg-amber-50/40 border border-amber-200/80 rounded-2xl animate-in fade-in duration-300">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-2xl shrink-0">👔</span>
              <div>
                <h4 className="font-bold text-surface-900 text-sm sm:text-base">Konfiguracja Osobistego Asystenta AI</h4>
                <p className="text-xs text-surface-500">Dostosuj wiedzę o sobie, bufor między spotkaniami oraz poranny raport.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Twoje Imię i Nazwisko (Właściciel Asystenta) *
                </label>
                <input 
                  type="text" 
                  value={ownerName} 
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="np. Jan Kowalski"
                  className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary text-sm bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Forma gramatyczna (Płeć właściciela) *
                </label>
                <select
                  value={ownerGender}
                  onChange={e => setOwnerGender(e.target.value)}
                  className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary text-sm bg-white font-medium"
                >
                  <option value="MALE">Mężczyzna (pan Jan, jego działalności)</option>
                  <option value="FEMALE">Kobieta (pani Anna, jej działalności)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="text-sm sm:text-[16.5px] text-surface-800 bg-amber-50/90 p-4 sm:p-5 rounded-2xl border-2 border-amber-300/80 space-y-2.5 break-words shadow-2xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl shrink-0">💬</span>
                    <span className="font-bold text-surface-950 text-base sm:text-lg tracking-tight">
                      Inteligentne powitanie dwuetapowe (z nieznanego numeru):
                    </span>
                  </div>
                  <div className="leading-relaxed pl-1 sm:pl-2">
                    <span className="font-bold text-amber-950">Tura 1:</span> „Witam, jestem asystentem wirtualnym {ownerGender === 'FEMALE' ? 'pani' : 'pana'} {getOwnerGenitive(ownerName, ownerGender)}, z kim mam przyjemność?”
                  </div>
                  <div className="leading-relaxed pl-1 sm:pl-2">
                    <span className="font-bold text-amber-950">Tura 2:</span> „{ownerGender === 'FEMALE' ? 'Pani' : 'Pan'} {getOwnerNominative(ownerName, ownerGender)} nie może w tej chwili odebrać, ale posiadam wiedzę o {ownerGender === 'FEMALE' ? 'jej' : 'jego'} działalności – chętnie odpowiem na pytania merytoryczne. Mogę też przekazać wiadomość albo umówić kontakt osobisty, w czym mogę pomóc?”
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Wykonywany zawód / Specjalizacja
                </label>
                <input 
                  type="text" 
                  value={profession} 
                  onChange={e => setProfession(e.target.value)}
                  placeholder="np. Architekt, Radca Prawny, Konsultant"
                  className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary text-sm bg-white"
                />
                <p className="text-[11px] text-surface-500 mt-1">Asystent uwzględni Twój zawód przy rozmowach z dzwoniącymi.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Nazwa Twojej Marki / Praktyki (opcjonalnie)
                </label>
                <input 
                  type="text" 
                  value={companyName} 
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="np. MDM Energy"
                  className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary text-sm bg-white"
                />
                <p className="text-[11px] text-surface-500 mt-1">Używane, jeśli prowadzisz praktykę lub działalność pod marką.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Logistyczny bufor odstępu między spotkaniami
                </label>
                <select 
                  value={bufferMinutes} 
                  onChange={e => setBufferMinutes(parseInt(e.target.value, 10))}
                  className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary text-sm bg-white"
                >
                  <option value={0}>Brak bufora (0 min)</option>
                  <option value={10}>10 minut odstępu</option>
                  <option value={15}>15 minut odstępu (zalecane)</option>
                  <option value={30}>30 minut odstępu</option>
                  <option value={45}>45 minut odstępu</option>
                  <option value={60}>60 minut odstępu</option>
                </select>
                <p className="text-[11px] text-surface-500 mt-1">Czas na dojazd, oddech lub notatki przed kolejnym spotkaniem.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  O mnie / BIO (Baza wiedzy wstrzykiwana do promptu AI)
                </label>
                <textarea 
                  rows={3}
                  value={bioSummary} 
                  onChange={e => setBioSummary(e.target.value)}
                  placeholder="np. 'Jestem adwokatem specjalizującym się w prawie gospodarczym. Spotkania prowadzę w kancelarii w Warszawie lub online. W piątki po 15:00 nie odbieram telefonów. W pilnych sprawach karnych prosić o SMS.'"
                  className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary text-sm bg-white"
                />
                <p className="text-[11px] text-surface-500 mt-1">Wirtualna asystentka zapozna się z tym tekstem i będzie się nim kierować podczas rozmowy.</p>
              </div>

              {/* Harmonogram Hybrydowy: Strefa Pracy vs Strefa Prywatna per-dzień */}
              <div className="md:col-span-2 p-3 sm:p-5 rounded-2xl border border-gold-200/80 bg-gradient-to-br from-amber-50/40 via-white to-gold-50/20 space-y-4 sm:space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gold-100 pb-3">
                  <div className="flex items-start sm:items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-gold-500 text-white shadow-sm shrink-0 mt-0.5 sm:mt-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-surface-900 text-sm sm:text-base">Harmonogram Dostępności & Strefy Czasowe</h4>
                      <p className="text-xs text-surface-600">Asystent inteligentnie dopasowuje propozycje terminów do charakteru kontaktu i dnia tygodnia.</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={setStandardSchedule}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-surface-200 hover:border-gold-400 text-surface-800 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                      title="Ustaw godziny pracy 8:00–16:00 dla Pn–Pt oraz strefę prywatną dla Pn–Nd"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-gold-600 shrink-0" />
                      <span>Ustaw standardowe 8:00–16:00</span>
                    </button>
                    <button
                      type="button"
                      onClick={copyMondayToWeekdays}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-surface-200 hover:border-gold-400 text-surface-800 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                      title="Skopiuj ustawienia poniedziałku na wtorek, środę, czwartek i piątek"
                    >
                      <Copy className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Kopiuj Pn na Pn–Pt</span>
                    </button>
                  </div>
                </div>

                {/* Lista 7 dni tygodnia */}
                <div className="space-y-2.5">
                  {SCHEDULE_DAYS.map(day => {
                    const dayConf = personalSchedule.days?.[day.id] || DEFAULT_PERSONAL_DAYS[day.id];
                    const isWeekend = day.id === "6" || day.id === "0";
                    return (
                      <div key={day.id} className="p-2.5 sm:p-3 rounded-xl border border-surface-200/80 bg-white hover:border-gold-300 transition-all shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between gap-2 border-b border-surface-100 pb-1.5 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className={`w-8 h-6 flex items-center justify-center rounded-md text-xs font-bold shrink-0 ${isWeekend ? 'bg-amber-100 text-amber-900' : 'bg-surface-100 text-surface-800'}`}>
                              {day.short}
                            </span>
                            <span className="font-semibold text-xs text-surface-900">{day.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {dayConf.workEnabled ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100">Dzień roboczy</span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 font-medium border border-surface-200">Dzień wolny</span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {/* 1. Strefa Pracy */}
                          <div className={`p-2.5 rounded-lg border transition-all ${dayConf.workEnabled ? 'bg-blue-50/40 border-blue-200/80' : 'bg-surface-50/50 border-surface-200/60 opacity-80'}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={dayConf.workEnabled}
                                  onChange={e => updateDaySchedule(day.id, { workEnabled: e.target.checked })}
                                  className="w-4 h-4 text-blue-600 rounded accent-blue-600 cursor-pointer shrink-0"
                                />
                                <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                                  <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span>Godziny Pracy (Klienci)</span>
                                </span>
                              </label>
                            </div>
                            {dayConf.workEnabled ? (
                              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                                <input
                                  type="time"
                                  value={dayConf.workStart}
                                  onChange={e => updateDaySchedule(day.id, { workStart: e.target.value })}
                                  className="border border-surface-200 rounded-md px-2 py-1 text-xs font-mono bg-white focus:ring-1 focus:ring-blue-500 w-24 text-center shrink-0"
                                />
                                <span className="text-surface-400 font-bold">-</span>
                                <input
                                  type="time"
                                  value={dayConf.workEnd}
                                  onChange={e => updateDaySchedule(day.id, { workEnd: e.target.value })}
                                  className="border border-surface-200 rounded-md px-2 py-1 text-xs font-mono bg-white focus:ring-1 focus:ring-blue-500 w-24 text-center shrink-0"
                                />
                              </div>
                            ) : (
                              <p className="text-[11px] text-surface-500 italic py-0.5">Wolne od spraw zawodowych. Klienci usłyszą, że jesteś niedostępny.</p>
                            )}
                          </div>

                          {/* 2. Strefa Prywatna */}
                          <div className={`p-2.5 rounded-lg border transition-all ${dayConf.privateEnabled ? 'bg-emerald-50/40 border-emerald-200/80' : 'bg-surface-50/50 border-surface-200/60 opacity-80'}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={dayConf.privateEnabled}
                                  onChange={e => updateDaySchedule(day.id, { privateEnabled: e.target.checked })}
                                  className="w-4 h-4 text-emerald-600 rounded accent-emerald-600 cursor-pointer shrink-0"
                                />
                                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                                  <Home className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>Strefa Prywatna (Rodzina)</span>
                                </span>
                              </label>
                            </div>
                            {dayConf.privateEnabled ? (
                              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                                <input
                                  type="time"
                                  value={dayConf.privateStart}
                                  onChange={e => updateDaySchedule(day.id, { privateStart: e.target.value })}
                                  className="border border-surface-200 rounded-md px-2 py-1 text-xs font-mono bg-white focus:ring-1 focus:ring-emerald-500 w-24 text-center shrink-0"
                                />
                                <span className="text-surface-400 font-bold">-</span>
                                <input
                                  type="time"
                                  value={dayConf.privateEnd}
                                  onChange={e => updateDaySchedule(day.id, { privateEnd: e.target.value })}
                                  className="border border-surface-200 rounded-md px-2 py-1 text-xs font-mono bg-white focus:ring-1 focus:ring-emerald-500 w-24 text-center shrink-0"
                                />
                              </div>
                            ) : (
                              <p className="text-[11px] text-surface-500 italic py-0.5">Strefa prywatna wyłączona w ten dzień.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 3. Czas Skupienia & Lekcji (Deep Work) */}
                <div className="p-3.5 sm:p-4 rounded-xl border border-rose-200/90 bg-rose-50/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-rose-900 font-bold text-xs uppercase tracking-wider flex-wrap">
                        <GraduationCap className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Czas Skupienia & Lekcji (Blokady)</span>
                        <PageHelpButton
                          variant="circle_i"
                          title="Czas Skupienia i Lekcji (Deep Work)"
                          description="Zdefiniuj stałe godziny na prowadzenie zajęć, lekcji, zabiegów lub pracę w skupieniu. System bezwzględnie blokuje Twój kalendarz w tych oknach czasowych."
                          tips={[
                            "Asystent nigdy nie zaoferuje rozmówcy godzin kolidujących z czasem skupienia ani poza pracą.",
                            "Twarda weryfikacja backendowa uniemożliwia zapisanie spotkania w chronionym oknie (brak ryzyka pomyłki).",
                            "Gdy ktoś zadzwoni w trakcie Twoich zajęć, asystent uprzejmie poinformuje o Twojej niedostępności i zaproponuje inny termin lub zapisze wiadomość."
                          ]}
                          guideSectionId="personal-focus-blocks"
                        />
                      </div>
                      <p className="text-[11px] text-rose-800 mt-1 leading-tight">
                        Zablokuj stałe godziny na prowadzenie lekcji, wykładów, zabiegów lub nieprzerwaną pracę twórczą (Deep Work). W tych godzinach asystent nigdy nie proponuje spotkań ani połączeń.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addFocusBlock}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition shadow-2xs w-full sm:w-auto cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Dodaj blok skupienia</span>
                    </button>
                  </div>

                  {(!personalSchedule.focusBlocks || personalSchedule.focusBlocks.length === 0) ? (
                    <div className="p-4 bg-white/80 rounded-xl border border-rose-200/60 text-center py-4">
                      <p className="text-xs text-surface-600">
                        Brak zdefiniowanych bloków skupienia. Kliknij przycisk powyżej, aby dodać np. godziny prowadzonych zajęć.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {personalSchedule.focusBlocks.map((block, bIdx) => (
                        <div key={block.id || bIdx} className="p-3 bg-white rounded-xl border border-rose-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex-1 space-y-2.5 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={block.name}
                                onChange={e => updateFocusBlock(block.id, { name: e.target.value })}
                                placeholder="np. Lekcje języka, Rozprawy, Deep Work"
                                className="text-xs font-bold text-surface-900 bg-surface-50 border border-surface-200 rounded-lg px-2.5 py-1.5 w-full sm:w-64 focus:ring-1 focus:ring-rose-500"
                              />
                              <button
                                type="button"
                                onClick={() => removeFocusBlock(block.id)}
                                className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition md:hidden shrink-0 cursor-pointer"
                                title="Usuń blok skupienia"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 flex-wrap">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-[10px] text-surface-500 font-semibold uppercase mr-1 shrink-0">Dni:</span>
                                {DAY_LABELS.map(d => {
                                  const active = block.days?.includes(d.id);
                                  return (
                                    <button
                                      key={d.id}
                                      type="button"
                                      onClick={() => toggleFocusBlockDay(block.id, d.id)}
                                      className={`w-6 h-6 rounded-md text-[10px] font-bold transition cursor-pointer shrink-0 ${
                                        active 
                                          ? 'bg-rose-600 text-white shadow-2xs' 
                                          : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                      }`}
                                    >
                                      {d.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {!block.perDayEnabled ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-[10px] text-surface-500 font-semibold uppercase">Godz:</span>
                                    <input
                                      type="time"
                                      value={block.start}
                                      onChange={e => updateFocusBlock(block.id, { start: e.target.value })}
                                      className="border border-surface-200 rounded px-1.5 py-0.5 text-xs font-mono bg-surface-50 w-22 text-center"
                                    />
                                    <span className="text-surface-400">-</span>
                                    <input
                                      type="time"
                                      value={block.end}
                                      onChange={e => updateFocusBlock(block.id, { end: e.target.value })}
                                      className="border border-surface-200 rounded px-1.5 py-0.5 text-xs font-mono bg-surface-50 w-22 text-center"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleFocusBlockPerDay(block.id)}
                                    className="text-[11px] text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition cursor-pointer whitespace-nowrap"
                                  >
                                    + Różne godziny per dzień
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleFocusBlockPerDay(block.id)}
                                  className="text-[11px] text-surface-500 hover:text-surface-700 bg-surface-100 px-2 py-0.5 rounded transition cursor-pointer"
                                >
                                  Wróć do jednakowych godzin
                                </button>
                              )}
                            </div>

                            {block.perDayEnabled && (
                              <div className="mt-2 pt-2 border-t border-rose-100/80 space-y-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="text-[10px] font-bold text-rose-900 uppercase tracking-wider">
                                    Godziny dla poszczególnych dni:
                                  </span>
                                  {block.days?.includes(1) && (
                                    <button
                                      type="button"
                                      onClick={() => copyMondayToWorkdays(block.id)}
                                      className="text-[10px] font-semibold text-rose-800 bg-rose-100/80 hover:bg-rose-200 border border-rose-300 px-2 py-0.5 rounded-md transition inline-flex items-center gap-1 cursor-pointer"
                                      title="Skopiuj godziny Poniedziałku na pozostałe dni robocze (Wtorek-Piątek)"
                                    >
                                      📋 Kopiuj Pn na Pn–Pt
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {block.days?.map(dayId => {
                                    const dayLabel = DAY_LABELS.find(l => l.id === dayId)?.label || `Dzień ${dayId}`;
                                    const dTime = block.dayTimes?.[dayId] || { start: block.start || '10:00', end: block.end || '12:00' };
                                    return (
                                      <div key={dayId} className="flex items-center justify-between sm:justify-start gap-1.5 p-1.5 bg-rose-50/40 rounded-lg border border-rose-100 text-xs">
                                        <span className="text-[11px] font-bold text-rose-900 w-6 shrink-0">{dayLabel}:</span>
                                        <input
                                          type="time"
                                          value={dTime.start}
                                          onChange={e => updateFocusBlockDayTime(block.id, dayId, 'start', e.target.value)}
                                          className="border border-surface-200 rounded px-1 py-0.5 text-xs font-mono bg-white w-20 sm:w-22 text-center"
                                        />
                                        <span className="text-surface-400 font-bold">-</span>
                                        <input
                                          type="time"
                                          value={dTime.end}
                                          onChange={e => updateFocusBlockDayTime(block.id, dayId, 'end', e.target.value)}
                                          className="border border-surface-200 rounded px-1 py-0.5 text-xs font-mono bg-white w-20 sm:w-22 text-center"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFocusBlock(block.id)}
                            className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition hidden md:block self-center cursor-pointer"
                            title="Usuń blok skupienia"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Sloty z Dostępem Priorytetowym & 5. Cisza Nocna */}
                <div className="grid md:grid-cols-2 gap-4 pt-1">
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>Dostęp Priorytetowy (Złote Okienka)</span>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Kontakty z włączonym ptaszkiem <strong>„Udostępnij Terminy Priorytetowe”</strong> w bazie kontaktów otrzymują dostęp do Twoich dedykowanych okienek priorytetowych oraz strefy prywatnej z natychmiastowym pierwszeństwem.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={personalSchedule.nightProtection}
                        onChange={e => setPersonalSchedule(prev => ({ ...prev, nightProtection: e.target.checked }))}
                        className="mt-0.5 w-4 h-4 text-primary rounded accent-primary"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
                          <Moon className="w-3.5 h-3.5 text-slate-600" />
                          <span>Ochrona Ciszy Nocnej (22:00 – 07:00)</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          Asystent chroni Twój sen. Zwykłe połączenia są grzecznie odrzucane, a w przypadku kontaktu z kategorii <strong>Rodzina</strong> asystent weryfikuje pilność i tylko w nagłych sprawach wyzwala głośny alert na telefon.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 p-3.5 sm:p-4 rounded-xl border border-amber-200/80 bg-white space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={morningBriefingEnabled} 
                    onChange={e => setMorningBriefingEnabled(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary rounded accent-primary shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-surface-900 uppercase tracking-wider break-words">Poranny Raport Wykonawczy (Push & Panel z Kopiuj / Udostępnij)</span>
                      <PageHelpButton
                        variant="circle_i"
                        title="Poranny Raport i Podsumowanie Dnia"
                        description="Codzienny raport wykonawczy trafia bezpośrednio jako powiadomienie Push na Twój smartfon."
                        tips={[
                          "Raport zawiera zwięzłą liczbę spotkań, ważne rocznice i święta oraz sprawy pilne wymagające kontaktu.",
                          "Dzięki atomowej blokadzie w bazie danych raport przychodzi dokładnie raz, bez niepotrzebnych duplikatów.",
                          "Możesz też w dowolnym momencie zadzwonić do asystenta i poprosić o podsumowanie dnia głosem lub wysłanie szczegółowego raportu na e-mail."
                        ]}
                        guideSectionId="personal-reports-share"
                      />
                    </div>
                    <p className="text-xs text-surface-600 mt-0.5">Codzienny poranny briefing trafia bezpośrednio jako powiadomienie Push na Twój telefon oraz do panelu z możliwością szybkiego Skopiowania i Udostępnienia.</p>
                  </div>
                </label>

                {morningBriefingEnabled && (
                  <div className="pl-0 sm:pl-7 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pt-2 border-t border-surface-100">
                    <label className="text-xs font-medium text-surface-700">Godzina wysyłki raportu:</label>
                    <select 
                      value={morningBriefingHour} 
                      onChange={e => setMorningBriefingHour(parseInt(e.target.value, 10))}
                      className="rounded-lg border border-surface-200 px-2.5 py-1 text-xs outline-none focus:border-primary bg-white w-full sm:w-auto"
                    >
                      <option value={6}>06:00 rano</option>
                      <option value={7}>07:00 rano</option>
                      <option value={8}>08:00 rano (domyślnie)</option>
                      <option value={9}>09:00 rano</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 p-3.5 sm:p-4 rounded-xl border border-amber-200/80 bg-white space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={ownerRequirePin} 
                    onChange={e => setOwnerRequirePin(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary rounded accent-primary shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-surface-900 uppercase tracking-wider break-words">Wymagaj PIN przy połączeniu z mojego numeru komórkowego</span>
                      <PageHelpButton
                        variant="circle_i"
                        title="Weryfikacja Tożsamości Właściciela kodem PIN"
                        description="Gdy dzwonisz ze swojej komórki, asystent poprosi o podanie kodu PIN przed odblokowaniem Twoich danych."
                        tips={[
                          "Zabezpiecza przed spoofingiem numeru telefonu i nieuprawnionym dostępem osób trzecich.",
                          "Dopóki nie podasz poprawnego PIN-u głosem, asystent nie ujawni żadnych spotkań, wiadomości ani spraw pilnych.",
                          "Po 3 nieudanych próbach następuje degradacja do roli gościa (GUEST)."
                        ]}
                        guideSectionId="personal-owner-mode"
                      />
                    </div>
                    <p className="text-xs text-surface-600 mt-0.5">Zabezpieczenie na wypadek spoofingu numeru telefonu lub dzwonienia przez osoby trzecie z Twojej komórki.</p>
                  </div>
                </label>
                {ownerRequirePin && (
                  <div className="mt-3 pt-3 border-t border-amber-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 animate-in fade-in">
                    <label className="text-xs font-semibold text-surface-700">
                      Twój kod PIN Właściciela:
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      placeholder="7777"
                      value={pinCode}
                      onChange={e => setPinCode(e.target.value.replace(/\D/g, ''))}
                      className="w-28 px-3 py-1.5 text-center font-mono font-bold tracking-widest text-sm rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50/50 text-surface-900"
                    />
                    <span className="text-xs text-surface-500">Tylko cyfry (np. 7777). Asystent zapyta o ten kod, gdy zadzwonisz ze swojej komórki.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="mb-6">
          <h4 className="font-medium text-surface-900 mb-3">Wybór głosu Asystenta AI</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'Aoede', title: 'Głos Żeński 1', desc: 'Spokojny, profesjonalny.' },
              { id: 'Kore', title: 'Głos Żeński 2', desc: 'Młodszy, energiczny.' },
              { id: 'Puck', title: 'Głos Męski 1', desc: 'Młody, energiczny.' },
              { id: 'Charon', title: 'Głos Męski 2', desc: 'Głęboki, dojrzały, autorytatywny.' }
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

        <div className="mt-8 border-t border-surface-200 pt-6 mb-6">
          <h3 className="text-xl font-serif text-surface-900 mb-6">Personalizacja Asystenta</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className={businessProfile === 'personal' ? 'md:col-span-2' : ''}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-surface-700">Imię Asystenta</label>
                <label className="inline-flex items-center gap-1.5 text-xs text-surface-600 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={!botName || botName.trim() === ''}
                    onChange={(e) => {
                      if (e.target.checked) setBotName('');
                      else setBotName('Ewa');
                    }}
                    className="w-3.5 h-3.5 rounded border-surface-300 text-primary accent-primary"
                  />
                  <span>Bez imienia</span>
                </label>
              </div>
              <input 
                type="text" 
                disabled={!botName || botName.trim() === ''}
                value={botName} 
                onChange={(e) => setBotName(e.target.value)}
                placeholder={(!botName || botName.trim() === '') ? 'Asystent bez imienia (wita ogólnie)' : 'np. Ewa'}
                className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary disabled:bg-surface-100 disabled:text-surface-400"
              />
              <div className="text-xs text-surface-500 mt-1">
                {(!botName || botName.trim() === '') 
                  ? 'Asystent nie będzie używał konkretnego imienia (przedstawi się ogólnie jako Wirtualny Asystent).' 
                  : 'Pod tym imieniem asystent będzie witał dzwoniących.'}
              </div>
            </div>

            {businessProfile !== 'personal' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Rola / Funkcja Asystenta</label>
                  <select 
                    value={assistantRole} 
                    onChange={(e) => setAssistantRole(e.target.value)}
                    className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary"
                  >
                    <option value="receptionist">Wirtualna Recepcja i Umawianie Wizyt</option>
                    <option value="sales_consultant">Aktywny Doradca Sprzedażowy</option>
                    <option value="support_complaints">Biuro Obsługi Klienta i Pomoc Techniczna</option>
                  </select>
                  <div className="text-xs text-surface-500 mt-1">Określa priorytety dialogowe asystenta w trakcie rozmowy.</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Domyślny Poziom Formalności (Rejestr Językowy)</label>
                  <select 
                    value={defaultFormalityLevel} 
                    onChange={(e) => setDefaultFormalityLevel(e.target.value)}
                    className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary"
                  >
                    <option value="formal_pan_pani">Oficjalny (Zawsze per Pan / Pani)</option>
                    <option value="professional_friendly">Profesjonalny i Uprzejmy (Domyślny, partnerski)</option>
                    <option value="direct_ty">Bezpośredni (Na Ty - jeśli rozmówca przejdzie na Ty)</option>
                  </select>
                  <div className="text-xs text-surface-500 mt-1">Dla nowych i nierozpoznanych rozmówców. Kontakty VIP i Klienci mogą mieć własny styl.</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Styl wypowiedzi (Ton głosu)</label>
                  <select 
                    value={toneOfVoice} 
                    onChange={(e) => setToneOfVoice(e.target.value)}
                    className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary"
                  >
                    <option value="profesjonalny i przyjazny">Profesjonalny i przyjazny</option>
                    <option value="luźny, ziomkowski">Luźny, na luzie</option>
                    <option value="bardzo formalny i kulturalny">Formalny, elegancki</option>
                  </select>
                  <div className="text-xs text-surface-500 mt-1">Decyduje o charakterze rozmowy.</div>

                  <div className="mt-3 p-2.5 rounded-xl border border-gold-200/80 bg-gold-50/40 flex items-start gap-2.5">
                    <input 
                      type="checkbox" 
                      id="proactiveMode" 
                      checked={proactiveMode} 
                      onChange={e => setProactiveMode(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-gold-600 accent-gold-600 rounded cursor-pointer"
                    />
                    <label htmlFor="proactiveMode" className="text-xs text-surface-700 cursor-pointer">
                      <span className="font-bold text-surface-900 block">Tryb Proaktywny</span>
                      <span>Zamiast pytać „w czym jeszcze mogę pomóc?”, asystent aktywnie proponuje 1–2 powiązane pytania lub usługi z bazy wiedzy.</span>
                    </label>
                  </div>
                </div>
              </>
            )}
            <div className="md:col-span-2 p-3.5 sm:p-4 rounded-xl border border-amber-200 bg-amber-50/40 mt-2 space-y-2">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="text-sm font-bold text-surface-900">Baza Wiedzy Poufnej (PIN dostępu)</span>
                <PageHelpButton
                  variant="circle_i"
                  title="Baza Wiedzy Poufnej (PIN)"
                  description="Dedykowany kod PIN chroniący wpisy Q&A oznaczone jako Poufne przed nieautoryzowanym dostępem."
                  tips={[
                    "Domyślny PIN to 7777 (możesz go zmienić na dowolny inny ciąg cyfr).",
                    "PIN do wiedzy poufnej jest niezależny od Twojego głównego PIN-u Właściciela.",
                    "Asystent poprosi rozmówcę o ten PIN wyłącznie wtedy, gdy ten zapyta o temat oznaczony jako poufny.",
                    "Po poprawnym podaniu PIN-u asystent odblokowuje poufną treść na czas trwania danej rozmowy."
                  ]}
                  guideSectionId="personal-confidential-knowledge"
                />
              </div>
              <p className="text-xs text-surface-600 mb-3 leading-relaxed">
                W Bazie Wiedzy możesz oznaczyć wybrane pytania i odpowiedzi jako <strong>Poufne</strong>. Asystent odpowie na nie dzwoniącemu tylko wtedy, gdy ten poda poniższy kod PIN.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <label className="text-xs font-semibold text-surface-700">
                  Kod PIN do Wiedzy Poufnej:
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="7777"
                  value={confidentialPin}
                  onChange={e => setConfidentialPin(e.target.value.replace(/\D/g, ''))}
                  className="w-28 px-3 py-1.5 text-center font-mono font-bold tracking-widest text-sm rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-surface-900 shadow-2xs"
                />
                <span className="text-xs text-surface-500">Domyślnie: <strong>7777</strong>. Podaj ten kod zaufanym osobom, partnerom lub pracownikom.</span>
              </div>
            </div>

            <div className="md:col-span-2 mt-2">
              <label className="block text-sm font-medium text-surface-700 mb-1">
                {businessProfile === 'personal' ? 'Twój prywatny adres e-mail (do raportów i powiadomień)' : 'Email kontaktowy firmy'}
              </label>
              <input 
                type="email" 
                value={contactEmail} 
                onChange={e => setContactEmail(e.target.value)}
                className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary text-sm"
                placeholder={businessProfile === 'personal' ? 'np. twoj.email@poczta.pl' : 'np. kontakt@mojafirma.pl'}
              />
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="emailPublic" 
                  checked={emailPublicForAi} 
                  onChange={e => setEmailPublicForAi(e.target.checked)}
                  className="w-4 h-4 text-primary accent-primary shrink-0"
                />
                <label htmlFor="emailPublic" className="text-xs sm:text-sm text-surface-700 cursor-pointer">
                  Udostępnij AI (dzwoniący mogą pytać o email) / odznacz, jeśli tylko do kontaktu z nami
                </label>
              </div>
            </div>
            <div className="md:col-span-2 mt-2">
              <label className="block text-sm font-medium text-surface-700 mb-1">Twój Wirtualny Numer Telefonu (SIP / SMS)</label>
              <input 
                type="text" 
                value={assignedPhoneNumber || 'Brak przypisanego numeru - Skontaktuj się z obsługą'} 
                readOnly
                className="w-full rounded-xl border border-surface-200 p-2.5 bg-surface-50 outline-none text-surface-500 font-mono text-sm"
              />
              <div className="text-xs text-surface-500 mt-1 leading-relaxed">
                {businessProfile === 'personal' 
                  ? 'Na ten numer ustawiasz przekierowanie w telefonie (*21* lub *61*). Asystent odbierze połączenie, gdy nie możesz rozmawiać.'
                  : 'Klienci firmy powinni dzwonić pod ten numer. Numery są przypisywane indywidualnie dla każdego najemcy.'}
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={saveTenantSettings}
          disabled={isSaving}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-surface-800 hover:text-white transition-colors cursor-pointer w-full sm:w-auto justify-center"
        >
          <Save className="w-4 h-4" /> Zapisz Profil
        </button>
      </div>

      {/* Automatyzacje NPS (tylko profile firmowe) */}
      {businessProfile !== 'personal' && (
        <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-sm border border-surface-200/60 mt-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-xl font-serif text-surface-900">Automatyzacje NPS i Oceny (Funkcja Premium)</h3>
            <PageHelpButton
              variant="circle_i"
              title="Automatyzacje NPS i Oceny"
              description="System automatycznie monitoruje wizyty. Jeśli dodasz linki do opinii, asystent AI może po wizycie wysłać SMS z prośbą o ocenę (skala 1-5)."
              tips={[
                "Oceny pozytywne (np. 4-5) otrzymają bezpośredni link np. do Google Maps lub Booksy.",
                "Oceny negatywne (1-3) nie są publikowane publicznie – trafiają bezpośrednio do Ciebie jako notatka z uwagami klienta.",
                "Wklej bezpośrednie linki do zbierania recenzji w polach poniżej."
              ]}
              guideSectionId="nps-automation"
            />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">Uniwersalny link do opinii 1 (np. Google Maps)</label>
              <input type="text" value={reviewLink1} onChange={e => setReviewLink1(e.target.value)} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold-500 transition-shadow text-sm" placeholder="https://g.page/r/..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">Uniwersalny link do opinii 2 (np. Booksy, Facebook)</label>
              <input type="text" value={reviewLink2} onChange={e => setReviewLink2(e.target.value)} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold-500 transition-shadow text-sm" placeholder="https://booksy.com/..." />
            </div>
          </div>
          <div className="flex justify-start pt-4 mt-4">
            <button onClick={saveTenantSettings} disabled={isSaving} className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-surface-800 hover:text-white transition-colors disabled:opacity-50 cursor-pointer w-full sm:w-auto justify-center">
              <Save className="w-4 h-4" /> {isSaving ? 'Zapisywanie...' : 'Zapisz NPS'}
            </button>
          </div>
        </div>
      )}

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

      {(businessProfile === 'team' || businessProfile === 'facility') && (
        <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-sm border border-surface-200/60">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
            <h3 className="text-xl font-serif text-surface-900">Zarządzanie Zespołem / Zasobami</h3>
            <button 
              onClick={openAddStaff}
              className="bg-surface-100 text-surface-900 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-surface-200 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Dodaj
            </button>
          </div>

          <div className="space-y-3">
            {staffList.map(staff => (
              <div key={staff.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-surface-50 rounded-xl border border-surface-100 gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-gold-100 p-2 rounded-lg text-gold-700 shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-surface-900 text-sm sm:text-base">{staff.name}</div>
                    <div className="text-xs text-surface-500">{staff.role || 'Pracownik'}</div>
                  </div>
                </div>
                <div className="flex gap-2 self-end sm:self-auto">
                  <button onClick={() => openEditStaff(staff)} className="text-xs sm:text-sm text-surface-600 hover:text-surface-900 px-3 py-1.5 bg-white border border-surface-200 rounded-lg shadow-sm cursor-pointer">Edytuj</button>
                  <button onClick={() => deleteStaff(staff.id)} className="text-xs sm:text-sm text-red-600 hover:text-red-700 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg shadow-sm cursor-pointer">Usuń</button>
                </div>
              </div>
            ))}
            {staffList.length === 0 && <div className="text-surface-500 text-center py-4 text-sm">Brak dodanych pracowników.</div>}
          </div>
        </div>
      )}

      {isStaffModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-surface-900/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsStaffModalOpen(false);
            }}
          >
            <div className="glass-card bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 relative w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
                <h3 className="text-lg sm:text-xl font-serif text-surface-900 leading-tight">
                  {currentStaff ? (businessProfile === 'facility' ? 'Edytuj zasób' : 'Edytuj pracownika') : (businessProfile === 'facility' ? 'Dodaj zasób / obiekt' : 'Dodaj pracownika')}
                </h3>
                <button onClick={() => setIsStaffModalOpen(false)} className="p-1.5 text-surface-400 hover:text-surface-900 hover:bg-surface-100 rounded-lg shrink-0 -mr-1 -mt-1 cursor-pointer transition-colors" title="Zamknij">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">{businessProfile === 'facility' ? 'Nazwa zasobu (np. Mieszkanie, Sala, Sprzęt)' : 'Imię i nazwisko'}</label>
                  <input 
                    type="text" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})}
                    className="w-full bg-white border border-surface-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-gold-500/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">{businessProfile === 'facility' ? 'Kategoria (np. Budynek, Pojazd)' : 'Rola / Stanowisko'}</label>
                  <input 
                    type="text" value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})}
                    className="w-full bg-white border border-surface-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-gold-500/50 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center flex-wrap gap-1">
                    <label className="block text-xs font-medium text-surface-500 mb-1">Godziny pracy</label>
                    <button type="button" onClick={() => {
                      const mon = staffForm.schedule["1"];
                      const newSch = { ...staffForm.schedule };
                      ["2","3","4","5"].forEach(d => newSch[d] = { ...mon });
                      setStaffForm({...staffForm, schedule: newSch});
                    }} className="text-xs text-primary hover:underline cursor-pointer">Kopiuj z Pn na Pn-Pt</button>
                  </div>
                  <div className="border border-surface-200 rounded-xl overflow-hidden text-xs sm:text-sm">
                    {["1", "2", "3", "4", "5", "6", "0"].map(day => {
                      const dayNames:any = {"1": "Pn", "2": "Wt", "3": "Śr", "4": "Cz", "5": "Pt", "6": "Sb", "0": "Nd"};
                      const ds = staffForm.schedule[day] || { isWorking: false, start: "09:00", end: "17:00" };
                      return (
                        <div key={day} className="flex items-center gap-2 p-2 bg-white border-b border-surface-100 last:border-0 flex-wrap sm:flex-nowrap">
                          <div translate="no" className="w-7 font-medium text-surface-600 shrink-0">{dayNames[day]}</div>
                          <input type="checkbox" checked={ds.isWorking} onChange={e => {
                            setStaffForm({...staffForm, schedule: {...staffForm.schedule, [day]: {...ds, isWorking: e.target.checked}}});
                          }} className="rounded text-gold-600 focus:ring-gold-500 shrink-0" />
                          
                          <input type="time" value={ds.start} disabled={!ds.isWorking} onChange={e => {
                            setStaffForm({...staffForm, schedule: {...staffForm.schedule, [day]: {...ds, start: e.target.value}}});
                          }} className="border border-surface-200 rounded px-1.5 py-0.5 disabled:opacity-50 text-xs font-mono w-20 sm:w-22 text-center" />
                          <span className="text-surface-400 font-bold">-</span>
                          <input type="time" value={ds.end} disabled={!ds.isWorking} onChange={e => {
                            setStaffForm({...staffForm, schedule: {...staffForm.schedule, [day]: {...ds, end: e.target.value}}});
                          }} className="border border-surface-200 rounded px-1.5 py-0.5 disabled:opacity-50 text-xs font-mono w-20 sm:w-22 text-center" />
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-2">Wykonywane Usługi</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {services.map(svc => (
                      <label key={svc.id} className="flex items-center gap-2 text-sm text-surface-800 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={staffForm.serviceIds.includes(svc.id)}
                          onChange={() => toggleService(svc.id)}
                          className="rounded border-surface-300 text-gold-600 focus:ring-gold-500 shrink-0"
                        />
                        <span>{svc.name}</span>
                      </label>
                    ))}
                    {services.length === 0 && <span className="text-xs text-surface-500">Brak dostępnych usług.</span>}
                  </div>
                </div>

                <div className="pt-4 flex gap-2 shrink-0">
                  <button onClick={() => setIsStaffModalOpen(false)} className="flex-1 py-2 bg-surface-100 rounded-xl text-sm font-medium hover:bg-surface-200 cursor-pointer">Anuluj</button>
                  <button onClick={saveStaff} className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-surface-800 hover:text-white transition-colors cursor-pointer">Zapisz</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
