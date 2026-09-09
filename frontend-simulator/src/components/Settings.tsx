import PageHelpButton from './common/PageHelpButton';
import { useEffect, useState } from 'react';
import { Save, Plus, X, User } from 'lucide-react';

const defaultSchedule = {
  "1": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "2": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "3": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "4": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "5": { "isWorking": true, "start": "09:00", "end": "17:00" },
  "6": { "isWorking": false, "start": "10:00", "end": "14:00" },
  "0": { "isWorking": false, "start": "10:00", "end": "14:00" }
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
  const [contactEmail, setContactEmail] = useState('');
  const [emailPublicForAi, setEmailPublicForAi] = useState(false);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Pola asystenta osobistego
  const [profession, setProfession] = useState('');
  const [bioSummary, setBioSummary] = useState('');
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [ownerRequirePin, setOwnerRequirePin] = useState(false);
  const [morningBriefingEnabled, setMorningBriefingEnabled] = useState(true);
  const [morningBriefingHour, setMorningBriefingHour] = useState(8);

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
        setBotName(tData.botName || 'Ewa');
        setToneOfVoice(tData.toneOfVoice || 'profesjonalny i przyjazny');
        setReviewLink1(tData.reviewLink1 || '');
        setReviewLink2(tData.reviewLink2 || '');
        setContactEmail(tData.contactEmail || '');
        setEmailPublicForAi(tData.emailPublicForAi || false);
        setAssignedPhoneNumber(tData.assignedPhoneNumber || '');

        setProfession(tData.profession || '');
        setBioSummary(tData.bioSummary || '');
        setBufferMinutes(tData.bufferMinutes ?? 15);
        setOwnerRequirePin(tData.ownerRequirePin ?? false);
        setMorningBriefingEnabled(tData.morningBriefingEnabled ?? true);
        setMorningBriefingHour(tData.morningBriefingHour ?? 8);
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
            businessProfile, 
            aiVoice, 
            bookingMode, 
            botName, 
            toneOfVoice, 
            reviewLink1, 
            reviewLink2, 
            contactEmail, 
            emailPublicForAi,
            profession,
            bioSummary,
            bufferMinutes,
            ownerRequirePin,
            morningBriefingEnabled,
            morningBriefingHour
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

  if (loading) return <div className="p-8">Ładowanie...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Ustawienia Firmy</h2>
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
          </div>
        <p className="text-surface-500 mt-1">Konfiguruj profil działalności i zespół pracowników.</p>
      </div>

      <div className="glass-card rounded-2xl p-6 shadow-sm border border-surface-200/60">
        <h3 className="text-xl font-serif text-surface-900 mb-4">Profil Biznesowy</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { id: 'solo', title: 'Solo (Salon)', desc: 'Jeden kalendarz główny, jeden usługodawca.' },
            { id: 'team', title: 'Zespół (Salon)', desc: 'Wielu pracowników świadczących różne usługi.' },
            { id: 'facility', title: 'Obiekty', desc: 'Rezerwacja gabinetów lub zasobów bez pracownika.' },
            { id: 'personal', title: 'Osobisty Asystent AI', desc: 'Dla prawników, lekarzy, architektów, konsultantów i inżynierów.' }
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

        {businessProfile === 'personal' && (
          <div className="mb-8 p-5 bg-amber-50/40 border border-amber-200/80 rounded-2xl animate-in fade-in duration-300">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-2xl">👔</span>
              <div>
                <h4 className="font-bold text-surface-900 text-base">Konfiguracja Osobistego Asystenta AI</h4>
                <p className="text-xs text-surface-500">Dostosuj wiedzę o sobie, bufor między spotkaniami oraz poranny raport.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Wykonywany zawód / Specjalizacja
                </label>
                <input 
                  type="text" 
                  value={profession} 
                  onChange={e => setProfession(e.target.value)}
                  placeholder="np. Architekt, Radca Prawny, Programista, Lekarz, Doradca"
                  className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary text-sm bg-white"
                />
                <p className="text-[11px] text-surface-500 mt-1">Asystentka uwzględni Twój zawód przy powitaniach i rozmowach z dzwoniącymi.</p>
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

              <div className="md:col-span-2 p-4 rounded-xl border border-amber-200/80 bg-white space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={morningBriefingEnabled} 
                    onChange={e => setMorningBriefingEnabled(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary rounded accent-primary"
                  />
                  <div>
                    <span className="text-xs font-bold text-surface-900 uppercase tracking-wider">Poranny Raport Wykonawczy (Morning Executive Briefing)</span>
                    <p className="text-xs text-surface-600 mt-0.5">Codzienny e-mail podsumowujący harmonogram dnia, rocznice/urodziny klientów i wiadomości z ostatnich 24h.</p>
                  </div>
                </label>

                {morningBriefingEnabled && (
                  <div className="pl-7 flex items-center gap-3 pt-1 border-t border-surface-100">
                    <label className="text-xs font-medium text-surface-700">Godzina wysyłki raportu:</label>
                    <select 
                      value={morningBriefingHour} 
                      onChange={e => setMorningBriefingHour(parseInt(e.target.value, 10))}
                      className="rounded-lg border border-surface-200 px-2.5 py-1 text-xs outline-none focus:border-primary bg-white"
                    >
                      <option value={6}>06:00 rano</option>
                      <option value={7}>07:00 rano</option>
                      <option value={8}>08:00 rano (domyślnie)</option>
                      <option value={9}>09:00 rano</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 p-4 rounded-xl border border-amber-200/80 bg-white">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={ownerRequirePin} 
                    onChange={e => setOwnerRequirePin(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary rounded accent-primary"
                  />
                  <div>
                    <span className="text-xs font-bold text-surface-900 uppercase tracking-wider">Wymagaj PIN przy połączeniu z mojego numeru komórkowego</span>
                    <p className="text-xs text-surface-600 mt-0.5">Zabezpieczenie na wypadek spoofingu numeru telefonu lub dzwonienia przez osoby trzecie z Twojej komórki.</p>
                  </div>
                </label>
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
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Imię Asystenta</label>
              <input 
                type="text" 
                value={botName} 
                onChange={(e) => setBotName(e.target.value)}
                className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary"
              />
              <div className="text-xs text-surface-500 mt-1">Pod tym imieniem asystent będzie witał klientów.</div>
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
                <option value="bardzo formalny i kulturalny">Formalny, medyczny</option>
              </select>
              <div className="text-xs text-surface-500 mt-1">Decyduje o charakterze rozmowy.</div>
            </div>
            <div className="md:col-span-2 mt-2">
              <label className="block text-sm font-medium text-surface-700 mb-1">Email kontaktowy firmy</label>
              <input 
                type="email" 
                value={contactEmail} 
                onChange={e => setContactEmail(e.target.value)}
                className="w-full rounded-xl border border-surface-200 p-2.5 outline-none focus:border-primary"
                placeholder="np. kontakt@mojafirma.pl"
              />
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="emailPublic" 
                  checked={emailPublicForAi} 
                  onChange={e => setEmailPublicForAi(e.target.checked)}
                  className="w-4 h-4 text-primary accent-primary"
                />
                <label htmlFor="emailPublic" className="text-sm text-surface-700">
                  Udostępnij AI (klienci mogą pytać o email) / odznacz, jeśli tylko do kontaktu z nami
                </label>
              </div>
            </div>
            <div className="md:col-span-2 mt-2">
              <label className="block text-sm font-medium text-surface-700 mb-1">Twój Wirtualny Numer Telefonu (SIP / SMS)</label>
              <input 
                type="text" 
                value={assignedPhoneNumber || 'Brak przypisanego numeru - Skontaktuj się z obsługą'} 
                readOnly
                className="w-full rounded-xl border border-surface-200 p-2.5 bg-surface-50 outline-none text-surface-500 font-mono"
              />
              <div className="text-xs text-surface-500 mt-1">Klienci firmy powinni dzwonić pod ten numer. Numery są przypisywane indywidualnie dla każdego najemcy.</div>
            </div>
          </div>
        </div>

        <button 
          onClick={saveTenantSettings}
          disabled={isSaving}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-surface-800 hover:text-white transition-colors"
        >
          <Save className="w-4 h-4" /> Zapisz Profil
        </button>
      </div>

      {/* Automatyzacje NPS */}
      <div className="glass-card rounded-2xl p-6 shadow-sm border border-surface-200/60 mt-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <h3 className="text-xl font-serif text-surface-900">Automatyzacje NPS i Oceny (Funkcja Premium)</h3>
          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gold-100 text-gold-600 cursor-pointer" onClick={() => setIsTooltipOpen(!isTooltipOpen)}>
            <span className="text-sm font-bold">i</span>
            {isTooltipOpen && (
              <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm sm:absolute sm:left-1/2 sm:top-auto sm:bottom-full sm:translate-y-0 mb-2 p-5 bg-surface-900 text-white text-[13px] sm:text-xs rounded-2xl shadow-2xl z-[100] text-left leading-relaxed cursor-default" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-gold-300 text-sm">Jak działają automatyzacje?</span>
                  <button onClick={(e) => { e.stopPropagation(); setIsTooltipOpen(false); }} className="text-surface-400 hover:text-white p-1 -mr-2 -mt-2"><X className="w-4 h-4" /></button>
                </div>
                System automatycznie monitoruje wizyty. Jeśli dodasz linki do opinii, asystent AI może po wizycie wysłać SMS z prośbą o ocenę (skala 1-5). Oceny pozytywne otrzymają bezpośredni link np. do Google Maps. Oceny negatywne trafią do Ciebie jako notatka.
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Uniwersalny link do opinii 1 (np. Google Maps)</label>
            <input type="text" value={reviewLink1} onChange={e => setReviewLink1(e.target.value)} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold-500 transition-shadow" placeholder="https://g.page/r/..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Uniwersalny link do opinii 2 (np. Booksy, Facebook)</label>
            <input type="text" value={reviewLink2} onChange={e => setReviewLink2(e.target.value)} className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold-500 transition-shadow" placeholder="https://booksy.com/..." />
          </div>
        </div>
        <div className="flex justify-start pt-4 mt-4">
          <button onClick={saveTenantSettings} disabled={isSaving} className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-surface-800 hover:text-white transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" /> {isSaving ? 'Zapisywanie...' : 'Zapisz NPS'}
          </button>
        </div>
      </div>

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
        <div className="glass-card rounded-2xl p-6 shadow-sm border border-surface-200/60">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-serif text-surface-900">Zarządzanie Zespołem / Zasobami</h3>
            <button 
              onClick={openAddStaff}
              className="bg-surface-100 text-surface-900 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-surface-200 transition-colors"
            >
              <Plus className="w-4 h-4" /> Dodaj
            </button>
          </div>

          <div className="space-y-3">
            {staffList.map(staff => (
              <div key={staff.id} className="flex justify-between items-center p-4 bg-surface-50 rounded-xl border border-surface-100">
                <div className="flex items-center gap-4">
                  <div className="bg-gold-100 p-2 rounded-lg text-gold-700">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-surface-900">{staff.name}</div>
                    <div className="text-xs text-surface-500">{staff.role || 'Pracownik'}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditStaff(staff)} className="text-sm text-surface-600 hover:text-surface-900 px-3 py-1.5 bg-white border border-surface-200 rounded-lg shadow-sm">Edytuj</button>
                  <button onClick={() => deleteStaff(staff.id)} className="text-sm text-red-600 hover:text-red-700 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg shadow-sm">Usuń</button>
                </div>
              </div>
            ))}
            {staffList.length === 0 && <div className="text-surface-500 text-center py-4">Brak dodanych pracowników.</div>}
          </div>
        </div>
      )}

      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-900/40 backdrop-blur-sm">
          <div className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-6 relative w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-xl font-serif text-surface-900">{currentStaff ? (businessProfile === 'facility' ? 'Edytuj zasób' : 'Edytuj pracownika') : (businessProfile === 'facility' ? 'Dodaj zasób / obiekt' : 'Dodaj pracownika')}</h3>
              <button onClick={() => setIsStaffModalOpen(false)} className="p-1.5 text-surface-400 hover:text-surface-900 hover:bg-surface-100 rounded-lg shrink-0 -mr-1 -mt-1 cursor-pointer transition-colors" title="Zamknij">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">{businessProfile === 'facility' ? 'Nazwa zasobu (np. Mieszkanie, Sala, Sprzęt)' : 'Imię i nazwisko'}</label>
                <input 
                  type="text" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})}
                  className="w-full bg-white border border-surface-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-gold-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">{businessProfile === 'facility' ? 'Kategoria (np. Budynek, Pojazd)' : 'Rola / Stanowisko'}</label>
                <input 
                  type="text" value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})}
                  className="w-full bg-white border border-surface-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-gold-500/50"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-medium text-surface-500 mb-1">Godziny pracy</label>
                  <button type="button" onClick={() => {
                    const mon = staffForm.schedule["1"];
                    const newSch = { ...staffForm.schedule };
                    ["2","3","4","5"].forEach(d => newSch[d] = { ...mon });
                    setStaffForm({...staffForm, schedule: newSch});
                  }} className="text-xs text-primary hover:underline">Kopiuj z Pn na Pn-Pt</button>
                </div>
                <div className="border border-surface-200 rounded-xl overflow-hidden text-sm">
                  {["1", "2", "3", "4", "5", "6", "0"].map(day => {
                    const dayNames:any = {"1": "Pn", "2": "Wt", "3": "Śr", "4": "Cz", "5": "Pt", "6": "Sb", "0": "Nd"};
                    const ds = staffForm.schedule[day] || { isWorking: false, start: "09:00", end: "17:00" };
                    return (
                      <div key={day} className="flex items-center gap-2 p-2 bg-white border-b border-surface-100 last:border-0">
                        <div translate="no" className="w-8 font-medium text-surface-600">{dayNames[day]}</div>
                        <input type="checkbox" checked={ds.isWorking} onChange={e => {
                          setStaffForm({...staffForm, schedule: {...staffForm.schedule, [day]: {...ds, isWorking: e.target.checked}}});
                        }} className="rounded text-gold-600 focus:ring-gold-500" />
                        
                        <input type="time" value={ds.start} disabled={!ds.isWorking} onChange={e => {
                          setStaffForm({...staffForm, schedule: {...staffForm.schedule, [day]: {...ds, start: e.target.value}}});
                        }} className="border border-surface-200 rounded px-1 disabled:opacity-50" />
                        <span className="text-surface-400">-</span>
                        <input type="time" value={ds.end} disabled={!ds.isWorking} onChange={e => {
                          setStaffForm({...staffForm, schedule: {...staffForm.schedule, [day]: {...ds, end: e.target.value}}});
                        }} className="border border-surface-200 rounded px-1 disabled:opacity-50" />
                      </div>
                    )
                  })}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-2">Wykonywane Usługi</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {services.map(svc => (
                    <label key={svc.id} className="flex items-center gap-2 text-sm text-surface-800">
                      <input 
                        type="checkbox" 
                        checked={staffForm.serviceIds.includes(svc.id)}
                        onChange={() => toggleService(svc.id)}
                        className="rounded border-surface-300 text-gold-600 focus:ring-gold-500"
                      />
                      {svc.name}
                    </label>
                  ))}
                  {services.length === 0 && <span className="text-xs text-surface-500">Brak dostępnych usług.</span>}
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button onClick={() => setIsStaffModalOpen(false)} className="flex-1 py-2 bg-surface-100 rounded-xl text-sm font-medium hover:bg-surface-200">Anuluj</button>
                <button onClick={saveStaff} className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-surface-800 hover:text-white transition-colors">Zapisz</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
