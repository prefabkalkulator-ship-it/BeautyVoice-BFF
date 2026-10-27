import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Headphones, 
  Phone, 
  PhoneOff, 
  X, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Zap, 
  BookOpen, 
  Lock, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  ChevronRight, 
  Plus, 
  Save, 
  GraduationCap,
  Volume2,
  Mic,
  MicOff,
  UserCheck,
  Copy,
  Check,
  PhoneCall
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CopilotCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerPhone: string;
  customerName?: string;
  customerId?: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface Battlecard {
  category: 'OBJECTION' | 'FACT_QUERY' | 'BUYING_SIGNAL' | 'DEESCALATION';
  heading: string;
  bullets: string[];
  faqSource?: 'current' | 'permanent' | 'confidential' | null;
  faqSnippet?: string;
  urgency: 'high' | 'medium' | 'low';
}

// Predefiniowane matryce celów i argumentów per scenariusz
const SCENARIO_PRESETS: Record<string, { checklist: ChecklistItem[]; initialCard: Battlecard }> = {
  sales: {
    checklist: [
      { id: 's1', text: 'Zbadaj aktualne potrzeby i parametry inwestycji', checked: false },
      { id: 's2', text: 'Wskaż warianty i aktualną promocję z Bazy Czasowej', checked: false },
      { id: 's3', text: 'Ustal termin przesłania koncepcji / kalkulacji', checked: false }
    ],
    initialCard: {
      category: 'BUYING_SIGNAL',
      heading: 'Otwarcie rozmowy handlowej',
      bullets: [
        'Zbadaj wielkość i planowany termin inwestycji',
        'Podkreśl szybkość montażu i izolacyjność konstrukcji',
        'Wskaż aktualną promocję z Bazy Czasowej'
      ],
      faqSource: 'current',
      urgency: 'low'
    }
  },
  callback: {
    checklist: [
      { id: 'cb1', text: 'Nawiąż do ustaleń i prośby z poprzedniej rozmowy', checked: false },
      { id: 'cb2', text: 'Przedstaw skorygowaną specyfikację i warunki cenowe', checked: false },
      { id: 'cb3', text: 'Potwierdź akceptację i wyślij podsumowanie SMS', checked: false }
    ],
    initialCard: {
      category: 'BUYING_SIGNAL',
      heading: 'Oddzwonienie / Modyfikacja oferty',
      bullets: [
        'Nawiąż do poprzedniego kontaktu i zgłoszonej prośby',
        'Podaj zaktualizowany koszt i czas realizacji',
        'Ustal twardy kolejny krok i termin decyzji'
      ],
      faqSource: 'permanent',
      urgency: 'medium'
    }
  },
  complaint: {
    checklist: [
      { id: 'cp1', text: 'Wysłuchaj bez przerywania (aktywna deeskalacja)', checked: false },
      { id: 'cp2', text: 'Potwierdź zrozumienie problemu i przeproś za niedogodność', checked: false },
      { id: 'cp3', text: 'Zaproponuj konkretne rozwiązanie z procedury gwarancyjnej', checked: false }
    ],
    initialCard: {
      category: 'DEESCALATION',
      heading: 'Obsługa zgłoszenia / Deeskalacja',
      bullets: [
        'Wysłuchaj klienta bez wchodzenia w słowo',
        'Spisz dokładne punkty uwag do protokołu',
        'Zaproponuj termin wizyty serwisu lub rozwiązanie'
      ],
      faqSource: 'permanent',
      urgency: 'high'
    }
  },
  general: {
    checklist: [
      { id: 'g1', text: 'Zbadaj bieżące potrzeby i parametry techniczne', checked: false },
      { id: 'g2', text: 'Odpowiedz na pytania w oparciu o Bazę FAQ', checked: false },
      { id: 'g3', text: 'Zaproponuj termin spotkania lub wysyłkę materiałów', checked: false }
    ],
    initialCard: {
      category: 'FACT_QUERY',
      heading: 'Konsultacja ogólna',
      bullets: [
        'Zbadaj stan działki i warunków zabudowy',
        'Wyjaśnij etapy realizacji: projekt, stan surowy, wykończenie',
        'Zaproponuj przesłanie katalogu projektów lub spotkanie'
      ],
      faqSource: 'permanent',
      urgency: 'low'
    }
  }
};

export default function CopilotCockpitModal({
  isOpen,
  onClose,
  customerPhone,
  customerName = 'Klient',
  customerId
}: CopilotCockpitModalProps) {
  // Stan fazy: 'setup' -> 'connecting' -> 'in_call' -> 'summary'
  const [callPhase, setCallPhase] = useState<'setup' | 'connecting' | 'in_call' | 'summary'>('setup');
  const [callMode, setCallMode] = useState<'conference' | 'bridge'>('conference'); // Konferencja z komórki jako domyślny tryb
  const [conferenceAssistantNumber, setConferenceAssistantNumber] = useState('');
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [scenario, setScenario] = useState<'sales' | 'complaint' | 'callback' | 'general'>('sales');
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isRepSpeaking, setIsRepSpeaking] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState('');
  const [assignedPhone, setAssignedPhone] = useState('');
  const [quickFaqModalOpen, setQuickFaqModalOpen] = useState(false);
  const [faqTab, setFaqTab] = useState<'current' | 'permanent' | 'confidential'>('current');
  const [faqs, setFaqs] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Notatki powoławcze i zadanie CRM
  const [postCallNote, setPostCallNote] = useState('');
  const [nextStepTask, setNextStepTask] = useState('');
  const [nextStepDate, setNextStepDate] = useState('');
  const [leadStage, setLeadStage] = useState<'IN_PROGRESS' | 'OFFER_SENT' | 'WON' | 'LOST'>('IN_PROGRESS');
  const [newChecklistText, setNewChecklistText] = useState('');

  // Dynamiczna Checklista i Aktywna Karta Bojowa (zainicjalizowane z presetów)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(SCENARIO_PRESETS.sales.checklist);
  const [activeBattlecard, setActiveBattlecard] = useState<Battlecard>(SCENARIO_PRESETS.sales.initialCard);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Funkcja zmiany scenariusza z synchronizacją checklisty i karty startowej
  const handleSelectScenario = (newScenario: 'sales' | 'complaint' | 'callback' | 'general') => {
    setScenario(newScenario);
    const preset = SCENARIO_PRESETS[newScenario];
    if (preset) {
      setChecklist(preset.checklist);
      setActiveBattlecard(preset.initialCard);
    }
  };

  // Pobierz dane tenanta, FAQ oraz historię kontaktu z klientem
  useEffect(() => {
    if (isOpen) {
      fetch('/api/tenant')
        .then(r => r.json())
        .then(t => {
          if (t?.phoneNumber) setOwnerPhone(t.phoneNumber);
          if (t?.assignedPhoneNumber) setAssignedPhone(t.assignedPhoneNumber);
        })
        .catch(() => {});

      fetch('/api/faq')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setFaqs(data);
        })
        .catch(() => {});

      // Sprawdź historię poprzednich kontaktów klienta (CallLog)
      const cleanPhone = customerPhone?.replace(/[\s\-\+]/g, '') || '';
      const last9 = cleanPhone.length >= 9 ? cleanPhone.slice(-9) : cleanPhone;
      if (customerId || last9) {
        const histUrl = customerId 
          ? `/api/customers/${customerId}/history`
          : `/api/customers/search?phone=${encodeURIComponent(last9)}`;

        fetch(histUrl)
          .then(r => r.json())
          .then(data => {
            const calls = data.recentCalls || data.callLogs || data.calls || [];
            if (calls.length > 0 && calls[0]?.summary) {
              const clean = calls[0].summary.replace(/^\[[^\]]+\]\s*/, '').trim();
              setScenario('callback');
              setChecklist([
                { id: 'cb1', text: clean.startsWith('Nawiąż do') ? clean : `Nawiąż do: ${clean}`, checked: false },
                { id: 'cb2', text: 'Przedstaw skorygowaną specyfikację i warunki cenowe', checked: false },
                { id: 'cb3', text: 'Potwierdź akceptację i wyślij podsumowanie SMS', checked: false }
              ]);
              setActiveBattlecard({
                category: 'BUYING_SIGNAL',
                heading: `Odprawa: ${customerName}`,
                bullets: [
                  clean,
                  calls[0].actionItems ? `Zadanie: ${calls[0].actionItems}` : 'Cel: potwierdzić nowe parametry i cenę',
                  'Baza FAQ: zweryfikuj specyfikację i rabat czasowy'
                ],
                faqSource: 'permanent',
                urgency: 'high'
              });
            }
          })
          .catch(() => {});
      }
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isOpen, customerId, customerPhone]);

  // Licznik czasu połączenia w fazie 'in_call'
  useEffect(() => {
    if (callPhase === 'in_call') {
      timerRef.current = setInterval(() => {
        setCallDurationSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callPhase]);

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleChecklist = (id: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklist(prev => [
      ...prev,
      { id: String(Date.now()), text: newChecklistText.trim(), checked: false }
    ]);
    setNewChecklistText('');
  };

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(true);
    toast.success('Skopiowano numer asystenta!', { icon: '📋' });
    setTimeout(() => setCopiedNumber(false), 3000);
  };

  // Uruchomienie Copilota w trybie Konferencji (Wariant A - Cichy Pasażer)
  const handleStartConferenceCall = async () => {
    setCallPhase('connecting');
    try {
      const res = await fetch('/api/copilot/start-conference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerPhone,
          customerName,
          scenario
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Błąd inicjalizacji sesji konferencyjnej.');
        setCallPhase('setup');
        return;
      }

      const num = data.assistantPhone || assignedPhone || '+48459568507';
      setConferenceAssistantNumber(num);

      if (data.sessionId) {
        setActiveSessionId(data.sessionId);
        try {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const ws = new WebSocket(`${protocol}//${window.location.host}/api/copilot-ui?sessionId=${data.sessionId}`);
          wsRef.current = ws;

          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'CALL_CONNECTED') {
                setCallPhase('in_call');
                toast.success('EVA dołączyła do konferencji! Asystent słucha i podpowiada na żywo.', { icon: '🎧', duration: 4000 });
              } else if (msg.type === 'SESSION_SNAPSHOT') {
                if (msg.activeBattlecard) setActiveBattlecard(msg.activeBattlecard);
                if (msg.checklist && msg.checklist.length > 0) setChecklist(msg.checklist);
              } else if (msg.type === 'BATTLECARD_UPDATE' && msg.battlecard) {
                setActiveBattlecard(msg.battlecard);
              } else if (msg.type === 'REP_SPEAKING') {
                setIsRepSpeaking(Boolean(msg.isSpeaking));
              } else if (msg.type === 'CALL_ENDED') {
                handleEndCall();
              }
            } catch (err) {
              console.warn('[Copilot UI] Błąd parsowania komunikatu WebSocket:', err);
            }
          };

          ws.onerror = (e) => {
            console.warn('[Copilot UI] WebSocket error:', e);
          };
        } catch (wsErr) {
          console.warn('[Copilot UI] Nie udało się otworzyć WebSocket:', wsErr);
        }
      }
    } catch (err: any) {
      toast.error('Błąd sieciowy podczas inicjalizacji Copilota.');
      setCallPhase('setup');
    }
  };

  const handleStartCopilotCall = async () => {
    setCallPhase('connecting');
    try {
      const res = await fetch('/api/copilot/start-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerPhone,
          customerName,
          scenario
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Błąd inicjalizacji połączenia.');
        setCallPhase('setup');
        return;
      }

      // Połączenie z kanałem WebSocket Copilota na żywo
      if (data.sessionId) {
        setActiveSessionId(data.sessionId);
        try {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const ws = new WebSocket(`${protocol}//${window.location.host}/api/copilot-ui?sessionId=${data.sessionId}`);
          wsRef.current = ws;

          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'CALL_CONNECTED') {
                setCallPhase('in_call');
              } else if (msg.type === 'SESSION_SNAPSHOT') {
                if (msg.activeBattlecard) setActiveBattlecard(msg.activeBattlecard);
                if (msg.checklist && msg.checklist.length > 0) setChecklist(msg.checklist);
              } else if (msg.type === 'BATTLECARD_UPDATE' && msg.battlecard) {
                setActiveBattlecard(msg.battlecard);
              } else if (msg.type === 'REP_SPEAKING') {
                setIsRepSpeaking(Boolean(msg.isSpeaking));
              } else if (msg.type === 'CALL_ENDED') {
                handleEndCall();
              }
            } catch (err) {
              console.warn('[Copilot UI] Błąd parsowania komunikatu WebSocket:', err);
            }
          };

          ws.onerror = (e) => {
            console.warn('[Copilot UI] WebSocket error:', e);
          };
        } catch (wsErr) {
          console.warn('[Copilot UI] Nie udało się otworzyć WebSocket:', wsErr);
        }
      }

      setCallPhase('in_call');
      toast.success('Centrala dzwoni na Twój telefon! Odbierz, by połączyć się z klientem.', { icon: '📞', duration: 5000 });
    } catch (err: any) {
      toast.error('Błąd sieciowy podczas inicjalizacji Copilota.');
      setCallPhase('setup');
    }
  };

  const handleEndCall = () => {
    setCallPhase('summary');
    if (timerRef.current) clearInterval(timerRef.current);
    if (activeSessionId) {
      fetch('/api/copilot/end-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId })
      }).catch(err => console.warn('[Copilot UI] Błąd kończenia sesji:', err));
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }
  };

  const handleSavePostCallSummary = async () => {
    try {
      const res = await fetch('/api/copilot/save-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerPhone,
          customerName,
          notes: postCallNote,
          nextStepTask,
          nextStepDate,
          leadStage,
          callDurationSeconds: callDurationSeconds || 60
        })
      });

      if (res.ok) {
        toast.success('Ustalenia i rozmowa zapisane w historii CRM!', { icon: '✅' });
      } else {
        toast.error('Błąd zapisu w CRM.');
      }
      onClose();
      // Reset stanu
      setCallPhase('setup');
      setCallDurationSeconds(0);
      setPostCallNote('');
      setNextStepTask('');
      setActiveSessionId(null);
    } catch (err) {
      toast.error('Błąd zapisu notatki.');
    }
  };

  // Szybkie wstrzykiwanie kart podpowiedzi FAQ / Obiekcji
  const triggerObjectionCard = (type: 'price' | 'time' | 'competitor' | 'promo') => {
    if (type === 'price') {
      setActiveBattlecard({
        category: 'OBJECTION',
        heading: 'Obiekcja cenowa („Za drogo” / Budżet)',
        bullets: [
          'Odliczenie płyty fundamentowej: oszczędność ~45-60 tys. zł',
          'Odliczenie wentylacji / rekuperacji: oszczędność ~18-25 tys. zł',
          'Możliwość realizacji fundamentu i wentylacji we własnym zakresie'
        ],
        faqSource: 'confidential',
        urgency: 'high'
      });
    } else if (type === 'promo') {
      setActiveBattlecard({
        category: 'BUYING_SIGNAL',
        heading: '⚡ Aktywna Promocja i Gwarancja Ceny',
        bullets: [
          'Rabat wdrożeniowy: -10% na stan deweloperski do końca miesiąca',
          'Gwarancja stałej ceny materiałów i montażu w umowie',
          'Bezpłatna adaptacja projektu do warunków działki'
        ],
        faqSource: 'current',
        urgency: 'medium'
      });
    } else if (type === 'time') {
      setActiveBattlecard({
        category: 'OBJECTION',
        heading: 'Czas realizacji i Harmonogram',
        bullets: [
          'Montaż ścian i konstrukcji na działce: 7-10 dni roboczych',
          'Produkcja prefabrykatów równolegle z formalnościami w urzędzie',
          'Precyzyjny harmonogram odbioru gwarantowany w umowie'
        ],
        faqSource: 'permanent',
        urgency: 'medium'
      });
    } else if (type === 'competitor') {
      setActiveBattlecard({
        category: 'FACT_QUERY',
        heading: 'Przewagi Technologii Prefabrykowanej',
        bullets: [
          'Współczynnik przenikania U = 0,14 W/m²K (standard energooszczędny)',
          'Ściany całkowicie suche – brak wilgoci technologicznej, start wykończenia od razu',
          '30 lat gwarancji konstrukcyjnej na elementy prefabrykowane'
        ],
        faqSource: 'permanent',
        urgency: 'low'
      });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 bg-surface-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl md:max-w-4xl lg:max-w-5xl shadow-2xl border border-surface-200 overflow-hidden flex flex-col max-h-[94vh] animate-scale-in">
        
        {/* NAGŁÓWEK KOKPITU */}
        <div className="bg-gradient-to-r from-surface-900 via-indigo-950 to-surface-900 text-white p-4 sm:p-5 md:p-6 flex items-center justify-between border-b border-surface-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Headphones className="w-5 h-5 md:w-6 md:h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-lg md:text-xl text-white tracking-wide">
                  EVA Live Call Copilot
                </h3>
              </div>
              <p className="text-xs md:text-sm text-surface-300">
                Rozmowa z: <strong className="text-white">{customerName}</strong> ({customerPhone})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {callPhase === 'in_call' && (
              <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 rounded-full text-xs md:text-sm font-mono font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {formatTimer(callDurationSeconds)}
              </div>
            )}
            <button
              onClick={onClose}
              className="text-surface-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
              title="Zamknij okno"
            >
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* FAZA 1: KONFIGURACJA PRZED POŁĄCZENIEM (SETUP) */}
        {/* ============================================================== */}
        {callPhase === 'setup' && (
          <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
            
            {/* Przełącznik trybu połączenia: Konferencja vs Centrala */}
            <div className="flex bg-surface-100 p-1.5 rounded-2xl border border-surface-200 gap-1.5">
              <button
                type="button"
                onClick={() => setCallMode('conference')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  callMode === 'conference'
                    ? 'bg-white text-indigo-950 shadow-sm border border-surface-200/80 ring-1 ring-black/5'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                <PhoneCall className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="flex items-center gap-1.5 flex-wrap justify-center">
                  <span>📞 Konferencja telefoniczna</span>
                  <span className="text-[10px] md:text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">Twój numer komórkowy</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCallMode('bridge')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  callMode === 'bridge'
                    ? 'bg-white text-indigo-950 shadow-sm border border-surface-200/80 ring-1 ring-black/5'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                <Headphones className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="flex items-center gap-1.5 flex-wrap justify-center">
                  <span>⚡ Centrala automatyczna</span>
                  <span className="text-[10px] md:text-xs bg-surface-200 text-surface-700 font-medium px-2 py-0.5 rounded-full">Numer stacjonarny</span>
                </span>
              </button>
            </div>

            {callMode === 'conference' ? (
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 sm:p-4 md:p-5 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs md:text-sm text-emerald-950 leading-relaxed">
                  <strong className="font-semibold block mb-1">Jak działa Konferencja z Copilotem (Klient widzi Twój numer):</strong>
                  1. Zadzwoń ze swojego telefonu komórkowego do klienta (<strong>{customerPhone}</strong>) — klient widzi Twój własny numer!<br/>
                  2. Podczas rozmowy kliknij na ekranie telefonu <strong>„Dodaj połączenie”</strong> i wybierz numer asystenta EVA: <strong>{assignedPhone || '+48 459 568 507'}</strong>.<br/>
                  3. Kliknij <strong>„Scal połączenia”</strong> (Konferencja). EVA dołączy <strong>całkowicie bezgłośnie</strong> jako cichy słuchacz i będzie podpowiadać na żywo na tym ekranie!
                </div>
              </div>
            ) : (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5 sm:p-4 md:p-5 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs md:text-sm text-indigo-950 leading-relaxed">
                  <strong className="font-semibold block mb-1">Połączenie przez Centralę automatyczną:</strong>
                  Gdy klikniesz poniższy przycisk, centrala najpierw zadzwoni na Twój telefon firmowy (<strong>{ownerPhone || 'Twój numer'}</strong>). Odbierz rozmowę, a system automatycznie połączy Cię z klientem. Copilot będzie w czasie rzeczywistym podpowiadał argumenty na tym ekranie!
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs md:text-sm font-bold uppercase tracking-wider text-surface-500 mb-2">
                Cel / Scenariusz rozmowy:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {[
                  { id: 'sales', label: '💼 Rozmowa handlowa / Oferta', desc: 'Prezentacja wartości, zbijanie obiekcji' },
                  { id: 'callback', label: '🔄 Oddzwonienie / Reaktywacja', desc: 'Klient prosił o kontakt lub powraca' },
                  { id: 'complaint', label: '🛡️ Reklamacja / Trudny klient', desc: 'Deeskalacja, empatia, rozwiązanie' },
                  { id: 'general', label: '📋 Konsultacja ogólna', desc: 'Wywiad potrzeb, ustalenie szczegółów' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectScenario(item.id as any)}
                    className={`p-3 md:p-4 rounded-2xl border text-left transition cursor-pointer ${
                      scenario === item.id 
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-2 ring-indigo-500/20' 
                        : 'border-surface-200 bg-surface-50 hover:bg-surface-100'
                    }`}
                  >
                    <div className="font-bold text-xs md:text-sm text-surface-900">{item.label}</div>
                    <div className="text-[11px] md:text-xs text-surface-500 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Checklista celów - w pełni interaktywna i edytowalna */}
            <div className="bg-surface-50 rounded-2xl p-3.5 sm:p-4 md:p-5 border border-surface-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs md:text-sm font-bold text-surface-800">
                <span>Checklista celów rozmowy:</span>
                <span className="text-xs md:text-sm text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                  {checklist.filter(c => c.checked).length} / {checklist.length} odhaczone
                </span>
              </div>
              <div className="space-y-1.5">
                {checklist.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleChecklist(item.id)}
                    className={`w-full flex items-center justify-between p-2.5 md:p-3 rounded-xl text-left text-xs md:text-sm transition cursor-pointer ${
                      item.checked 
                        ? 'bg-emerald-50 text-emerald-900 line-through opacity-80 border border-emerald-200' 
                        : 'bg-white text-surface-800 font-medium border border-surface-200 shadow-2xs hover:bg-surface-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.checked ? (
                        <CheckSquare className="w-4 h-4 md:w-5 md:h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 md:w-5 md:h-5 text-surface-400 shrink-0" />
                      )}
                      <span className="break-words text-wrap leading-relaxed">{item.text}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Dodawanie własnego punktu checklisty */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="+ Wpisz własny punkt (np. zapytać o budżet)..."
                  value={newChecklistText}
                  onChange={e => setNewChecklistText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddChecklistItem();
                  }}
                  className="flex-1 bg-white border border-surface-200 rounded-xl px-3 md:px-4 py-1.5 md:py-2.5 text-xs md:text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="px-3 md:px-4 py-1.5 md:py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 cursor-pointer text-xs md:text-sm font-bold shrink-0 transition"
                >
                  Dodaj
                </button>
              </div>
            </div>

            <div className="pt-2">
              {callMode === 'conference' ? (
                <button
                  type="button"
                  onClick={handleStartConferenceCall}
                  className="w-full py-4 md:py-4.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-700 to-indigo-700 hover:from-emerald-700 hover:to-indigo-800 text-white font-bold text-sm md:text-base transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 cursor-pointer"
                >
                  <Headphones className="w-5 h-5 md:w-6 md:h-6" />
                  Aktywuj nasłuch Copilota (Konferencja)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartCopilotCall}
                  className="w-full py-4 md:py-4.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm md:text-base transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-3 cursor-pointer"
                >
                  <PhoneCall className="w-5 h-5 md:w-6 md:h-6" />
                  Zadzwoń przez centralę automatyczną
                </button>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* FAZA 2: ŁĄCZENIE (CONNECTING) */}
        {/* ============================================================== */}
        {callPhase === 'connecting' && (
          <div className="p-8 sm:p-12 md:p-16 text-center space-y-5 md:space-y-6">
            {callMode === 'conference' ? (
              <>
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-pulse">
                  <Volume2 className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <div>
                  <h4 className="text-lg md:text-2xl font-bold text-surface-900">
                    EVA oczekuje na dołączenie do konferencji...
                  </h4>
                  <p className="text-xs md:text-sm text-surface-500 max-w-md mx-auto mt-2 leading-relaxed">
                    Zadzwoń ze swojego telefonu do klienta <strong>{customerPhone}</strong>. W trakcie rozmowy dodaj poniższy numer asystenta i kliknij <strong>„Scal”</strong>:
                  </p>
                </div>

                <div className="max-w-xs mx-auto bg-surface-50 border border-surface-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-xs">
                  <div className="text-left pl-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Numer asystenta EVA:</span>
                    <strong className="text-base md:text-lg font-mono text-indigo-900 tracking-wide">
                      {conferenceAssistantNumber || assignedPhone || '+48 459 568 507'}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyNumber(conferenceAssistantNumber || assignedPhone || '+48 459 568 507')}
                    className="p-2.5 bg-white hover:bg-surface-100 text-surface-700 rounded-xl border border-surface-200 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-2xs shrink-0"
                  >
                    {copiedNumber ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-surface-500" />}
                    <span>{copiedNumber ? 'Skopiowano' : 'Kopiuj'}</span>
                  </button>
                </div>

                <p className="text-[11px] md:text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-xl py-2 px-3 max-w-sm mx-auto">
                  🛡️ Asystent dołączy w 100% bezgłośnie. Ani Ty, ani klient nie usłyszycie głosu bota w słuchawce.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCallPhase('in_call')}
                    className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-bold transition cursor-pointer shadow-xs"
                  >
                    Przejdź od razu do podpowiedzi
                  </button>
                  <button
                    type="button"
                    onClick={() => setCallPhase('setup')}
                    className="text-xs md:text-sm text-surface-400 hover:text-surface-700 underline py-2 px-3"
                  >
                    Anuluj
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto animate-bounce">
                  <Phone className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <h4 className="text-base md:text-xl font-bold text-surface-900">
                  Dzwonię na Twój telefon...
                </h4>
                <p className="text-xs md:text-sm text-surface-500 max-w-sm md:max-w-md mx-auto leading-relaxed">
                  Odbierz połączenie przychodzące na swoim telefonie. Gdy podniesiesz słuchawkę, system natychmiast zadzwoni do klienta i aktywuje podpowiedzi.
                </p>
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setCallPhase('setup')}
                    className="text-xs md:text-sm text-surface-400 hover:text-surface-700 underline"
                  >
                    Anuluj
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* FAZA 3: AKTYWNY KOKPIT W TRAKCIE ROZMOWY (IN_CALL) */}
        {/* ============================================================== */}
        {callPhase === 'in_call' && (
          <div className="p-4 sm:p-5 md:p-6 space-y-4 md:space-y-5 overflow-y-auto flex-1">
            
            {/* PASEK STANU MÓWCY (UI Freeze Asymmetry) */}
            <div className="flex items-center justify-between bg-surface-100 p-2.5 md:p-3 rounded-2xl border border-surface-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRepSpeaking(!isRepSpeaking)}
                  className={`flex items-center gap-1.5 px-3 md:px-4 py-1 md:py-1.5 rounded-xl text-xs md:text-sm font-bold transition cursor-pointer ${
                    isRepSpeaking 
                      ? 'bg-amber-500 text-white shadow-sm' 
                      : 'bg-white text-surface-700 border border-surface-200'
                  }`}
                  title="Kliknij, aby przetestować asymetrię (gdy mówisz, UI zamraża się)"
                >
                  {isRepSpeaking ? <Mic className="w-3.5 h-3.5 md:w-4 md:h-4 animate-pulse" /> : <MicOff className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                  {isRepSpeaking ? '🎙️ Mówisz Ty (UI Zamrożone)' : '🎧 Słuchasz klienta (Aktywny)'}
                </button>
              </div>

              <div className="text-[11px] md:text-xs text-surface-500 font-medium">
                {isRepSpeaking ? 'Skup się na rozmowie' : 'Baza wiedzy zsynchronizowana'}
              </div>
            </div>

            {/* STREFA 1: DYNAMICZNA CHECKLISTA */}
            <div className="bg-white rounded-2xl border border-surface-200 p-3.5 md:p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs md:text-sm font-bold text-surface-800">
                <span className="flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                  Kroki rozmowy (Checklista):
                </span>
                <span className="text-[11px] md:text-xs text-surface-400 font-normal">
                  {checklist.filter(c => c.checked).length} / {checklist.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {checklist.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleChecklist(item.id)}
                    className={`w-full flex items-center gap-2.5 p-2 md:p-2.5 rounded-xl text-left text-xs md:text-sm transition cursor-pointer ${
                      item.checked 
                        ? 'bg-emerald-50 text-emerald-900 line-through opacity-80' 
                        : 'bg-surface-50 hover:bg-surface-100 text-surface-800 font-medium'
                    }`}
                  >
                    {item.checked ? (
                      <CheckSquare className="w-4 h-4 md:w-5 md:h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 md:w-5 md:h-5 text-surface-400 shrink-0" />
                    )}
                    <span className="break-words text-wrap leading-relaxed">{item.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* STREFA 2: GLANCEABLE BATTLECARD (<400ms scan time, max 3 bullety) */}
            <div className={`rounded-2xl p-4 md:p-5 border transition-all duration-200 shadow-sm ${
              activeBattlecard.category === 'OBJECTION' 
                ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20' 
                : activeBattlecard.category === 'BUYING_SIGNAL'
                  ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/20'
                  : 'bg-indigo-50/70 border-indigo-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                  <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-surface-700">
                    Podpowiedź AI:
                  </span>
                </div>
                {activeBattlecard.faqSource && (
                  <span className={`text-[10px] md:text-xs font-bold px-2 md:px-2.5 py-0.5 md:py-1 rounded-full flex items-center gap-1 ${
                    activeBattlecard.faqSource === 'current'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : activeBattlecard.faqSource === 'confidential'
                        ? 'bg-red-100 text-red-800 border border-red-200 font-mono'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}>
                    {activeBattlecard.faqSource === 'current' && <Zap className="w-3 h-3 md:w-3.5 md:h-3.5 text-purple-600" />}
                    {activeBattlecard.faqSource === 'confidential' && <Lock className="w-3 h-3 md:w-3.5 md:h-3.5 text-red-600" />}
                    {activeBattlecard.faqSource === 'current' ? 'Baza Czasowa (Promocje)' : (activeBattlecard.faqSource === 'confidential' ? '🔒 Baza Poufna' : 'Baza Stała FAQ')}
                  </span>
                )}
              </div>

              <h4 className="font-serif font-bold text-sm sm:text-base md:text-lg text-surface-900 mb-2">
                {activeBattlecard.heading}
              </h4>

              <ul className="space-y-1.5 md:space-y-2">
                {activeBattlecard.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs md:text-sm text-surface-800 font-semibold leading-relaxed">
                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-indigo-600 shrink-0 mt-1.5 md:mt-2"></span>
                    <span className="break-words text-wrap">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* STREFA 3: SZYBKIE PRZYCISKI WSTRZYKIWANIA ARGUMENTÓW (FAQ & OBJEKCJE) */}
            <div className="space-y-2">
              <div className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-surface-400">
                Szybkie karty argumentów (1-tap):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={() => triggerObjectionCard('price')}
                  className="p-2 md:p-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs md:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-600" />
                  Za drogo
                </button>
                <button
                  type="button"
                  onClick={() => triggerObjectionCard('promo')}
                  className="p-2 md:p-2.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs md:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-purple-600" />
                  Promocje (Czasowa)
                </button>
                <button
                  type="button"
                  onClick={() => triggerObjectionCard('time')}
                  className="p-2 md:p-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs md:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600" />
                  Brak czasu
                </button>
                <button
                  type="button"
                  onClick={() => triggerObjectionCard('competitor')}
                  className="p-2 md:p-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs md:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-600" />
                  Parametry FAQ
                </button>
              </div>
            </div>

            {/* ZAKOŃCZENIE POŁĄCZENIA */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleEndCall}
                className="w-full py-3 md:py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs md:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <PhoneOff className="w-4 h-4 md:w-5 md:h-5" />
                Zakończ rozmowę i przejdź do podsumowania
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* FAZA 4: PODSUMOWANIE I ZAPIS DO CRM (SUMMARY) */}
        {/* ============================================================== */}
        {callPhase === 'summary' && (
          <div className="p-4 sm:p-6 md:p-8 space-y-4 md:space-y-6 overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-surface-100 gap-2">
              <div>
                <h4 className="font-serif font-bold text-base md:text-lg text-surface-900">
                  Podsumowanie rozmowy z {customerName}
                </h4>
                <p className="text-xs md:text-sm text-surface-500">
                  Czas trwania: <strong>{formatTimer(callDurationSeconds)}</strong> • Odhaczone punkty checklisty: <strong>{checklist.filter(c => c.checked).length}/{checklist.length}</strong>
                </p>
              </div>
              <span className="text-emerald-700 bg-emerald-100 border border-emerald-200 text-xs md:text-sm font-bold px-3 py-1 rounded-full self-start sm:self-auto">
                Rozmowa zakończona
              </span>
            </div>

            {/* Status leada */}
            <div>
              <label className="block text-xs md:text-sm font-bold uppercase tracking-wider text-surface-600 mb-1.5">
                Etap relacji / Leada:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                {[
                  { id: 'IN_PROGRESS', label: 'W toku' },
                  { id: 'OFFER_SENT', label: 'Wysłana oferta' },
                  { id: 'WON', label: 'Sukces (Wygrana)' },
                  { id: 'LOST', label: 'Odłożona' }
                ].map(stage => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setLeadStage(stage.id as any)}
                    className={`py-2 md:py-2.5 px-3 md:px-4 rounded-xl text-xs md:text-sm font-semibold border transition cursor-pointer text-center ${
                      leadStage === stage.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50'
                    }`}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ustalenia / Notatka */}
            <div>
              <label className="block text-xs md:text-sm font-bold uppercase tracking-wider text-surface-600 mb-1.5">
                Kluczowe ustalenia z rozmowy:
              </label>
              <textarea
                rows={3}
                value={postCallNote}
                onChange={e => setPostCallNote(e.target.value)}
                placeholder="np. Klient zdecydowany na pakiet Osobisty Ekspert. Wymaga integracji z kalendarzem Google. Przesłać ofertę i link do płatności."
                className="w-full bg-surface-50 border border-surface-200 rounded-xl p-3 md:p-3.5 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
              />
            </div>

            {/* Następny krok */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-xs md:text-sm font-bold uppercase tracking-wider text-surface-600 mb-1.5">
                  Zadanie (Następny krok):
                </label>
                <input
                  type="text"
                  value={nextStepTask}
                  onChange={e => setNextStepTask(e.target.value)}
                  placeholder="np. Wysłać link do umowy i potwierdzić SMS"
                  className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 md:py-2.5 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-bold uppercase tracking-wider text-surface-600 mb-1.5">
                  Termin realizacji:
                </label>
                <input
                  type="date"
                  value={nextStepDate}
                  onChange={e => setNextStepDate(e.target.value)}
                  className="w-full bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 md:py-2.5 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 md:py-3.5 px-4 rounded-xl border border-surface-200 text-surface-600 font-semibold text-xs md:text-sm hover:bg-surface-50 transition cursor-pointer"
              >
                Pomiń zapis
              </button>
              <button
                type="button"
                onClick={handleSavePostCallSummary}
                className="flex-1 py-3 md:py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs md:text-sm transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4 md:w-5 md:h-5" />
                Zapisz do Kartoteki CRM
              </button>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}
