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
  onSuccess?: () => void;
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
  id?: string;
  timestamp?: string;
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
  onSuccess,
  customerPhone,
  customerName = 'Klient',
  customerId
}: CopilotCockpitModalProps) {
  // Stan fazy: 'setup' -> 'connecting' -> 'in_call' -> 'summary'
  const [callPhase, setCallPhase] = useState<'setup' | 'connecting' | 'in_call' | 'summary'>('setup');
  const [callMode, setCallMode] = useState<'conference' | 'bridge'>('conference'); // Konferencja z komórki jako domyślny tryb
  const [isCentralConnected, setIsCentralConnected] = useState(false);
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
  const [battlecards, setBattlecards] = useState<Battlecard[]>([
    {
      ...SCENARIO_PRESETS.sales.initialCard,
      id: 'bc_init',
      timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll do najnowszej karty podpowiedzi na osi czasu
  useEffect(() => {
    if (callPhase === 'in_call' && feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [battlecards, callPhase]);

  const disconnectRealtime = () => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }
    if (sseRef.current) {
      try { sseRef.current.close(); } catch (_) {}
      sseRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleCloseAndReset = () => {
    disconnectRealtime();
    setCallPhase('setup');
    setCallDurationSeconds(0);
    setIsCentralConnected(false);
    setPostCallNote('');
    setNextStepTask('');
    setNextStepDate('');
    setActiveSessionId(null);
    onClose();
  };

  // Funkcja zmiany scenariusza z synchronizacją checklisty i karty startowej
  const handleSelectScenario = (newScenario: 'sales' | 'complaint' | 'callback' | 'general') => {
    setScenario(newScenario);
    const preset = SCENARIO_PRESETS[newScenario];
    if (preset) {
      setChecklist(preset.checklist);
      const cardWithMeta: Battlecard = {
        ...preset.initialCard,
        id: `bc_init_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
      };
      setActiveBattlecard(cardWithMeta);
      setBattlecards([cardWithMeta]);
    }
  };

  // Pobierz dane tenanta, FAQ oraz historię kontaktu z klientem
  useEffect(() => {
    if (isOpen) {
      setCallPhase('setup');
      setCallDurationSeconds(0);
      setIsCentralConnected(false);
      setPostCallNote('');
      setNextStepTask('');
      setNextStepDate('');
      setActiveSessionId(null);

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

              // Czytelna, elegancka etykieta celu rozmowy zamiast surowego długiego tekstu
              let goalText = 'Nawiąż do ustaleń z poprzedniej rozmowy';
              const lowerClean = clean.toLowerCase();
              if (lowerClean.includes('modyfikacj') || lowerClean.includes('ofert')) {
                goalText = 'Nawiąż do prośby o modyfikację oferty';
              } else if (lowerClean.includes('płyt') || lowerClean.includes('fundament')) {
                goalText = 'Nawiąż do modyfikacji płyty fundamentowej';
              } else if (lowerClean.includes('rabat') || lowerClean.includes('cen')) {
                goalText = 'Nawiąż do warunków cenowych i rabatu';
              } else if (clean.length > 0 && clean.length <= 50) {
                goalText = clean.startsWith('Nawiąż do') ? clean : `Nawiąż do: ${clean}`;
              } else if (clean.length > 50) {
                goalText = `Nawiąż do: ${clean.slice(0, 42)}...`;
              }

              setChecklist([
                { id: 'cb1', text: goalText, checked: false },
                { id: 'cb2', text: 'Przedstaw skorygowaną specyfikację i warunki cenowe', checked: false },
                { id: 'cb3', text: 'Potwierdź akceptację i wyślij podsumowanie SMS', checked: false }
              ]);
              const callbackCard: Battlecard = {
                id: `bc_callback_${Date.now()}`,
                timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
                category: 'BUYING_SIGNAL',
                heading: `Odprawa: ${customerName}`,
                bullets: [
                  clean.length > 95 ? `${clean.slice(0, 92)}...` : clean,
                  calls[0].actionItems ? `Zadanie: ${calls[0].actionItems}` : 'Cel: potwierdzić nowe parametry i cenę',
                  'Baza FAQ: zweryfikuj specyfikację i rabat czasowy'
                ],
                faqSource: 'permanent',
                urgency: 'high'
              };
              setActiveBattlecard(callbackCard);
              setBattlecards([callbackCard]);
            }
          })
          .catch(() => {});
      }
    }

    return () => {
      disconnectRealtime();
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

  // Uniwersalny, trójwarstwowy konektor czasu rzeczywistego (Direct Cloud Run WS + SSE przez Firebase + Polling fallback)
  const connectRealtimeSession = (sessionId: string) => {
    disconnectRealtime();
    setActiveSessionId(sessionId);

    const handleMessage = (msg: any) => {
      try {
        if (msg.type === 'CENTRAL_STREAM_READY') {
          setIsCentralConnected(true);
        } else if (msg.type === 'CALL_CONNECTED') {
          setIsCentralConnected(true);
          if (callMode !== 'conference') {
            setCallPhase('in_call');
            toast.success('EVA dołączyła do rozmowy! Asystent słucha i podpowiada na żywo.', { icon: '🎧', duration: 4000 });
          }
        } else if (msg.type === 'SESSION_SNAPSHOT') {
          if (msg.battlecards && Array.isArray(msg.battlecards) && msg.battlecards.length > 0) {
            setBattlecards(msg.battlecards);
            setActiveBattlecard(msg.battlecards[msg.battlecards.length - 1]);
          } else if (msg.activeBattlecard) {
            setActiveBattlecard(msg.activeBattlecard);
            setBattlecards([msg.activeBattlecard]);
          }
          if (msg.checklist && msg.checklist.length > 0) setChecklist(msg.checklist);
        } else if (msg.type === 'BATTLECARD_UPDATE') {
          if (msg.battlecards && Array.isArray(msg.battlecards)) {
            setBattlecards(msg.battlecards);
            if (msg.battlecard) setActiveBattlecard(msg.battlecard);
          } else if (msg.battlecard) {
            setActiveBattlecard(msg.battlecard);
            setBattlecards(prev => {
              const exists = prev.some(c => c.id === msg.battlecard.id || (c.heading === msg.battlecard.heading && c.timestamp === msg.battlecard.timestamp));
              if (exists) return prev;
              return [...prev, msg.battlecard];
            });
          }
          // Nowe podpowiedzi wygenerowane na żywo (nie karta początkowa) automatycznie przełączają do in_call
          if (callMode !== 'conference' || (msg.battlecard?.id && !msg.battlecard.id.startsWith('bc_init'))) {
            setCallPhase(prev => prev === 'connecting' ? 'in_call' : prev);
          }
        } else if (msg.type === 'REP_SPEAKING') {
          setIsRepSpeaking(Boolean(msg.isSpeaking));
        } else if (msg.type === 'CALL_ENDED') {
          handleEndCall();
        }
      } catch (err) {
        console.warn('[Copilot UI] Błąd obsługi komunikatu:', err);
      }
    };

    // 1. Bezpośredni WebSocket do Cloud Run
    try {
      const isHostedPwa = window.location.host.includes('web.app') || window.location.host.includes('firebase');
      const wsHost = isHostedPwa ? 'beautyvoice-bff-739272851032.europe-central2.run.app' : window.location.host;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${wsHost}/api/copilot-ui?sessionId=${sessionId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch (_) {}
      };
      ws.onerror = (e) => {
        console.warn('[Copilot UI] WebSocket niedostępny, używam SSE:', e);
      };
    } catch (wsErr) {
      console.warn('[Copilot UI] Nie udało się otworzyć WebSocket:', wsErr);
    }

    // 2. Server-Sent Events (SSE) strumień zdarzeń przez proxy HTTP (niezawodny w Firebase Hosting)
    try {
      const sse = new EventSource(`/api/copilot/events?sessionId=${sessionId}`);
      sseRef.current = sse;
      sse.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch (_) {}
      };
      sse.onerror = (e) => {
        console.warn('[Copilot UI] SSE reconnecting...', e);
      };
    } catch (sseErr) {
      console.warn('[Copilot UI] Nie udało się otworzyć SSE:', sseErr);
    }

    // 3. Fallback polling co 2 sekundy w celu synchronizacji kart bojowych
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/copilot/session/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.battlecards && Array.isArray(data.battlecards) && data.battlecards.length > 0) {
            setBattlecards(prev => {
              if (prev.length !== data.battlecards.length || prev[prev.length - 1]?.id !== data.battlecards[data.battlecards.length - 1]?.id) {
                return data.battlecards;
              }
              return prev;
            });
            setActiveBattlecard(data.battlecards[data.battlecards.length - 1]);
            const hasLiveSpeechCard = data.battlecards.some((b: any) => b.id && !b.id.startsWith('bc_init'));
            if (callMode !== 'conference' || hasLiveSpeechCard) {
              setCallPhase(prev => prev === 'connecting' ? 'in_call' : prev);
            }
          } else if (data.activeBattlecard) {
            setActiveBattlecard(prev => {
              if (prev.heading !== data.activeBattlecard.heading) {
                return data.activeBattlecard;
              }
              return prev;
            });
          }
          if (data.isRepSpeaking !== undefined) {
            setIsRepSpeaking(Boolean(data.isRepSpeaking));
          }
        }
      } catch (_) {}
    }, 2000);
  };

  // Uruchomienie Copilota w trybie Odwróconej Konferencji (Mostek GSM)
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

      const num = data.assistantPhone || assignedPhone || '+48343433088';
      setConferenceAssistantNumber(num);

      if (data.sessionId) {
        connectRealtimeSession(data.sessionId);
      }
      toast.success('Centrala dzwoni na Twój telefon! Odbierz i dodaj klienta do rozmowy.', { icon: '📲', duration: 6000 });
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

      if (data.sessionId) {
        connectRealtimeSession(data.sessionId);
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
    disconnectRealtime();
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
        try {
          onSuccess?.();
        } catch (callErr) {
          console.warn('[Copilot] Błąd w onSuccess callback:', callErr);
        }
      } else {
        toast.error('Błąd zapisu w CRM.');
      }
    } catch (err) {
      toast.error('Błąd połączenia z serwerem podczas zapisu notatki.');
    } finally {
      handleCloseAndReset();
    }
  };

  // Szybkie wstrzykiwanie kart podpowiedzi FAQ / Obiekcji
  const triggerObjectionCard = (type: 'price' | 'time' | 'competitor' | 'promo') => {
    const nowTime = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    let card: Battlecard;

    if (type === 'price') {
      card = {
        id: `bc_quick_${Date.now()}`,
        timestamp: nowTime,
        category: 'OBJECTION',
        heading: 'Obiekcja cenowa („Za drogo” / Budżet)',
        bullets: [
          'Odliczenie płyty fundamentowej: oszczędność ~45-60 tys. zł',
          'Odliczenie wentylacji / rekuperacji: oszczędność ~18-25 tys. zł',
          'Możliwość realizacji fundamentu i wentylacji we własnym zakresie'
        ],
        faqSource: 'confidential',
        urgency: 'high'
      };
    } else if (type === 'promo') {
      card = {
        id: `bc_quick_${Date.now()}`,
        timestamp: nowTime,
        category: 'BUYING_SIGNAL',
        heading: '⚡ Aktywna Promocja i Gwarancja Ceny',
        bullets: [
          'Rabat wdrożeniowy: -10% na stan deweloperski do końca miesiąca',
          'Gwarancja stałej ceny materiałów i montażu w umowie',
          'Bezpłatna adaptacja projektu do warunków działki'
        ],
        faqSource: 'current',
        urgency: 'medium'
      };
    } else if (type === 'time') {
      card = {
        id: `bc_quick_${Date.now()}`,
        timestamp: nowTime,
        category: 'OBJECTION',
        heading: 'Czas realizacji i Harmonogram',
        bullets: [
          'Montaż ścian i konstrukcji na działce: 7-10 dni roboczych',
          'Produkcja prefabrykatów równolegle z formalnościami w urzędzie',
          'Precyzyjny harmonogram odbioru gwarantowany w umowie'
        ],
        faqSource: 'permanent',
        urgency: 'medium'
      };
    } else {
      card = {
        id: `bc_quick_${Date.now()}`,
        timestamp: nowTime,
        category: 'FACT_QUERY',
        heading: 'Przewagi Technologii Prefabrykowanej',
        bullets: [
          'Współczynnik przenikania U = 0,14 W/m²K (standard energooszczędny)',
          'Ściany całkowicie suche – brak wilgoci technologicznej, start wykończenia od razu',
          '30 lat gwarancji konstrukcyjnej na elementy prefabrykowane'
        ],
        faqSource: 'permanent',
        urgency: 'low'
      };
    }

    setActiveBattlecard(card);
    setBattlecards(prev => [...prev, card]);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 bg-surface-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl shadow-2xl border border-surface-200 overflow-hidden flex flex-col max-h-[94vh] md:max-h-[92vh] animate-scale-in">
        
        {/* NAGŁÓWEK KOKPITU */}
        <div className="bg-gradient-to-r from-surface-900 via-indigo-950 to-surface-900 text-white p-4 sm:p-5 md:p-6 flex items-center justify-between border-b border-surface-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Headphones className="w-5 h-5 md:w-6 md:h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-lg md:text-2xl text-white tracking-wide">
                  EVA Live Call Copilot
                </h3>
              </div>
              <p className="text-xs md:text-sm lg:text-base text-surface-300">
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
              onClick={handleCloseAndReset}
              className="text-surface-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
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
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
                <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm md:text-base text-emerald-950 leading-relaxed">
                  <strong className="font-bold block mb-1 text-emerald-900">
                    Jak działa Konferencja z Copilotem (Klient widzi Twój prawdziwy numer komórkowy):
                  </strong>
                  1. Po kliknięciu <strong>„Zadzwoń z Copilotem (Mostek GSM)”</strong>, centrala zadzwoni na Twój telefon ({ownerPhone || 'Twój numer'}). Odbierz połączenie.<br/>
                  2. W trakcie rozmowy naciśnij na telefonie <strong>„Dodaj połączenie” (+)</strong> i zadzwoń do klienta (<strong>{customerPhone}</strong>) — klient widzi bezpośrednio Twój numer z karty SIM!<br/>
                  3. Kliknij <strong>„Scal połączenia”</strong> (Konferencja GSM). EVA połączy się <strong>w 100% bezgłośnie</strong> i będzie podpowiadać na bieżąco w poniższym czacie!
                </div>
              </div>
            ) : (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
                <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm md:text-base text-indigo-950 leading-relaxed">
                  <strong className="font-bold block mb-1 text-indigo-900">Połączenie przez Centralę automatyczną:</strong>
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
            <div className="bg-surface-50 rounded-2xl p-3.5 sm:p-4 md:p-6 border border-surface-200 space-y-3">
              <div className="flex items-center justify-between text-xs md:text-base font-bold text-surface-800">
                <span>Checklista celów rozmowy:</span>
                <span className="text-xs md:text-sm text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200/60">
                  {checklist.filter(c => c.checked).length} / {checklist.length} odhaczone
                </span>
              </div>
              <div className="space-y-2">
                {checklist.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleChecklist(item.id)}
                    className={`w-full flex items-center justify-between p-2.5 md:p-3.5 rounded-xl text-left text-xs md:text-base transition cursor-pointer ${
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
                  Zadzwoń z Copilotem (Mostek GSM)
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
        {/* FAZA 2: PRZEJŚCIOWY MODAL - ZESTAWIANIE KONFERENCJI (CONNECTING) */}
        {/* ============================================================== */}
        {callPhase === 'connecting' && (
          <div className="p-4 sm:p-6 md:p-8 space-y-6 overflow-y-auto">
            {callMode === 'conference' ? (
              <div className="max-w-3xl mx-auto space-y-6">
                
                {/* NAGŁÓWEK FAZY ZESTAWIANIA */}
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs md:text-sm font-bold animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Centrala zestawia bezpieczny mostek konferencyjny
                  </div>
                  <h4 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-surface-900 tracking-tight">
                    Zestawienie połączenia w 3 prostych krokach
                  </h4>
                  <p className="text-xs sm:text-sm md:text-base text-surface-500 max-w-xl mx-auto">
                    Klient zobaczy <strong className="text-surface-900">Twój bezpośredni numer komórkowy</strong> (z Twojej karty SIM) i nie usłyszy żadnego automatu.
                  </p>
                </div>

                {/* 3 DUŻE KROKI */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* KROK 1 */}
                  <div className="bg-surface-50 border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative shadow-sm">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">1</span>
                        {isCentralConnected ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> Połączono
                          </span>
                        ) : (
                          <Volume2 className="w-5 h-5 text-emerald-600 animate-pulse" />
                        )}
                      </div>
                      <h5 className="font-bold text-sm sm:text-base text-surface-900">
                        Odbierz telefon z Centrali
                      </h5>
                      <p className="text-xs sm:text-sm text-surface-600 leading-relaxed">
                        Centrala dzwoni na Twój telefon:
                      </p>
                      <div className="bg-white px-3 py-2 rounded-xl border border-surface-200 font-mono text-xs sm:text-sm font-bold text-surface-900 flex items-center justify-between">
                        <span>{ownerPhone || 'Twój numer komórkowy'}</span>
                        {isCentralConnected ? (
                          <span className="text-[11px] sm:text-xs text-emerald-600 font-sans font-bold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Nasłuch gotowy
                          </span>
                        ) : (
                          <span className="text-[11px] sm:text-xs text-amber-600 font-sans font-semibold">Dzwoni...</span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-surface-500 italic">
                        *W słuchawce będzie cichy nasłuch AI (EVA nie mówi).
                      </p>
                    </div>
                  </div>

                  {/* KROK 2 */}
                  <div className="bg-surface-50 border-2 border-indigo-400 rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative shadow-sm">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">2</span>
                        <PhoneCall className="w-5 h-5 text-indigo-600" />
                      </div>
                      <h5 className="font-bold text-sm sm:text-base text-surface-900">
                        Dodaj połączenie do klienta
                      </h5>
                      <p className="text-xs sm:text-sm text-surface-600 leading-relaxed">
                        Na ekranie telefonu kliknij <strong>„Dodaj połączenie” (+)</strong> i zadzwoń do:
                      </p>
                      <div className="bg-white p-2.5 rounded-xl border border-surface-200 space-y-1.5">
                        <div className="font-bold text-xs sm:text-sm text-surface-900 truncate">
                          {customerName}
                        </div>
                        <div className="font-mono text-xs sm:text-base font-bold text-indigo-900">
                          {customerPhone}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleCopyNumber(customerPhone)}
                            className="flex-1 py-1.5 px-2 bg-surface-100 hover:bg-surface-200 text-surface-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            {copiedNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedNumber ? 'Skopiowano' : 'Kopiuj'}</span>
                          </button>
                          <a
                            href={`tel:${customerPhone}`}
                            className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Zadzwoń</span>
                          </a>
                        </div>
                      </div>
                      <p className="text-[11px] sm:text-xs text-emerald-800 font-semibold bg-emerald-50 rounded-lg p-1.5 border border-emerald-200">
                        🛡️ Klient widzi Twój bezpośredni numer!
                      </p>
                    </div>
                  </div>

                  {/* KROK 3 */}
                  <div className="bg-surface-50 border-2 border-teal-300 rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative shadow-sm">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold text-sm flex items-center justify-center">3</span>
                        <Sparkles className="w-5 h-5 text-teal-600" />
                      </div>
                      <h5 className="font-bold text-sm sm:text-base text-surface-900">
                        Scal połączenia (Konferencja)
                      </h5>
                      <p className="text-xs sm:text-sm text-surface-600 leading-relaxed">
                        Gdy klient odbierze, kliknij na telefonie <strong>„Scal połączenia”</strong>.
                      </p>
                      <div className="bg-teal-50/80 border border-teal-200 rounded-xl p-2.5 text-xs text-teal-950 space-y-1">
                        <div className="font-semibold">EVA połączy się bezgłośnie.</div>
                        <div className="text-[11px] text-teal-800">
                          Podpowiedzi zaczną automatycznie pojawiać się na żywo w poniższym czacie!
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* PRZYCISKI AKCJI I STATUS */}
                <div className="bg-white border border-surface-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isCentralConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600 animate-pulse'}`}>
                      <Headphones className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-surface-900">
                        {isCentralConnected ? 'Centrala połączona — dodaj klienta i scal rozmowę' : 'Centrala dzwoni na Twój telefon komórkowy...'}
                      </div>
                      <div className="text-[11px] sm:text-xs text-surface-500">
                        Instrukcja pozostaje na ekranie dopóki nie scalisz rozmowy i nie przejdziesz do podpowiedzi.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setCallPhase('in_call')}
                      className="flex-1 sm:flex-initial py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs sm:text-sm font-bold transition cursor-pointer shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                    >
                      <span>🟢 Połączenia scalone — przejdź do podpowiedzi</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseAndReset}
                      className="py-3.5 px-4 rounded-xl text-surface-400 hover:text-surface-700 hover:bg-surface-100 text-xs sm:text-sm font-medium transition cursor-pointer"
                    >
                      Anuluj
                    </button>
                  </div>
                </div>

              </div>
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
          <div className="p-3 sm:p-5 md:p-6 space-y-4 md:space-y-5 overflow-y-auto flex-1 flex flex-col">
            
            {/* PASEK STANU MÓWCY I SYNCHRONIZACJI */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-surface-100/90 p-2.5 sm:p-3 md:p-3.5 rounded-2xl border border-surface-200 gap-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                <div className="text-xs sm:text-sm md:text-base font-bold text-surface-900">
                  EVA nasłuchuje obu rozmówców
                </div>
                <span className="hidden sm:inline-block text-surface-400">•</span>
                <span className="text-[11px] sm:text-xs md:text-sm text-surface-600">
                  AI na żywo analizuje pytania klienta i Twoje propozycje handlowe
                </span>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <span className="text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200/80">
                  {scenario === 'sales' ? '💼 Rozmowa handlowa' : scenario === 'callback' ? '🔄 Oddzwonienie' : scenario === 'complaint' ? '🛡️ Reklamacja' : '📋 Konsultacja'}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200/80">
                  Karty: {battlecards.length}
                </span>
              </div>
            </div>

            {/* DWA PANELE NA DESKTOPIE (GRID 12 KOLUMN) / JEDNA KOLUMNA NA TELEFONIE */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 flex-1 min-h-0">
              
              {/* LEWA KOLUMNA: CHECKLISTA + SZYBKIE WSTRZYKIWANIE + ZAKOŃCZENIE */}
              <div className="md:col-span-5 flex flex-col gap-4">
                
                {/* CHECKLISTA CELÓW */}
                <div className="bg-white rounded-2xl border border-surface-200 p-3.5 sm:p-4 md:p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-xs sm:text-sm md:text-base font-bold text-surface-800">
                    <span className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                      Kroki rozmowy (Checklista):
                    </span>
                    <span className="text-[11px] sm:text-xs md:text-sm text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full font-bold border border-indigo-200/50">
                      {checklist.filter(c => c.checked).length} / {checklist.length}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {checklist.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggleChecklist(item.id)}
                        className={`w-full flex items-center gap-2.5 p-2.5 md:p-3 rounded-xl text-left text-xs sm:text-sm md:text-base transition cursor-pointer ${
                          item.checked 
                            ? 'bg-emerald-50 text-emerald-900 line-through opacity-80 border border-emerald-200/60' 
                            : 'bg-surface-50 hover:bg-surface-100 text-surface-800 font-medium border border-surface-200/80'
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

                  {/* Dodawanie własnego punktu */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="+ Wpisz własny punkt..."
                      value={newChecklistText}
                      onChange={e => setNewChecklistText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddChecklistItem();
                      }}
                      className="flex-1 bg-surface-50 border border-surface-200 rounded-xl px-3 py-1.5 md:py-2 text-xs md:text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddChecklistItem}
                      className="px-3 py-1.5 md:py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 cursor-pointer text-xs md:text-sm font-bold shrink-0 transition"
                    >
                      Dodaj
                    </button>
                  </div>
                </div>

                {/* SZYBKIE PRZYCISKI WSTRZYKIWANIA ARGUMENTÓW (1-TAP) */}
                <div className="bg-surface-50/70 border border-surface-200 rounded-2xl p-3 sm:p-4 space-y-2">
                  <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-surface-500">
                    Szybkie karty argumentów (1-tap):
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => triggerObjectionCard('price')}
                      className="p-2 sm:p-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-600 shrink-0" />
                      <span>Za drogo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerObjectionCard('promo')}
                      className="p-2 sm:p-2.5 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-purple-600 shrink-0" />
                      <span>Promocje (Czasowa)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerObjectionCard('time')}
                      className="p-2 sm:p-2.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600 shrink-0" />
                      <span>Harmonogram</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerObjectionCard('competitor')}
                      className="p-2 sm:p-2.5 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-600 shrink-0" />
                      <span>Parametry FAQ</span>
                    </button>
                  </div>
                </div>

                {/* ZAKOŃCZENIE POŁĄCZENIA */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleEndCall}
                    className="w-full py-3 md:py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm md:text-base transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <PhoneOff className="w-4 h-4 md:w-5 md:h-5" />
                    Zakończ rozmowę i przejdź do podsumowania
                  </button>
                </div>

              </div>

              {/* PRAWA KOLUMNA: CZAT PODPOWIEDZI AI / OŚ CZASU (LIVE FEED) */}
              <div className="md:col-span-7 flex flex-col min-h-0 bg-surface-50/80 border border-surface-200 rounded-3xl p-3 sm:p-4 md:p-5 shadow-xs">
                
                <div className="flex items-center justify-between pb-3 border-b border-surface-200/80 mb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                    <h4 className="font-bold text-xs sm:text-sm md:text-base uppercase tracking-wider text-surface-800">
                      Czat podpowiedzi AI na żywo (Oś czasu)
                    </h4>
                  </div>
                  <div className="text-[11px] sm:text-xs text-surface-400 font-medium">
                    Przewijaj w górę do historii
                  </div>
                </div>

                {/* SCROLLABLE FEED OF BATTLECARDS - CZYSTY TEKST WIERSZ ZA WIERSZEM */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[380px] md:max-h-[500px]">
                  {battlecards.map((card, idx) => {
                    const isLatest = idx === battlecards.length - 1;
                    return (
                      <div
                        key={card.id || `bc_${idx}`}
                        className={`text-left transition-all duration-150 py-2.5 px-3 rounded-xl border ${
                          isLatest
                            ? 'bg-indigo-50/70 border-indigo-200/90 shadow-2xs'
                            : 'bg-white/80 border-surface-200/70 hover:bg-white'
                        }`}
                      >
                        {/* WIERSZ NAGŁÓWKA: CZAS + ETYKIETA + TEMAT */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {card.timestamp && (
                            <span className="text-[11px] font-mono text-surface-400 font-medium shrink-0">
                              [{card.timestamp}]
                            </span>
                          )}

                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            card.category === 'OBJECTION'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : card.category === 'BUYING_SIGNAL'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : card.category === 'DEESCALATION'
                                  ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                  : 'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}>
                            {card.category === 'OBJECTION' ? '⚠️ Obiekcja' : card.category === 'BUYING_SIGNAL' ? '⚡ Szansa' : card.category === 'DEESCALATION' ? '🛡️ Deeskalacja' : '📋 Fakty/Cennik'}
                          </span>

                          {card.faqSource && (
                            <span className="text-[10px] font-semibold text-surface-500">
                              ({card.faqSource === 'current' ? 'Promocje' : card.faqSource === 'confidential' ? '🔒 Baza Poufna' : 'Baza Stała'})
                            </span>
                          )}

                          <span className="font-bold text-xs sm:text-sm md:text-base text-surface-900">
                            {card.heading}
                          </span>

                          {isLatest && (
                            <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
                              Nowe
                            </span>
                          )}
                        </div>

                        {/* WIERSZE Z ARGUMENTAMI - ZWARTA LISTA WIERSZ ZA WIERSZEM */}
                        <div className="pl-3 sm:pl-5 space-y-0.5 border-l-2 border-indigo-200/60 my-1">
                          {card.bullets.map((bullet, bIdx) => (
                            <div key={bIdx} className="text-xs sm:text-sm md:text-base text-surface-800 leading-snug flex items-start gap-1.5">
                              <span className="text-indigo-500 font-bold shrink-0">•</span>
                              <span className="break-words font-medium">{bullet}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={feedEndRef} />
                </div>

                <div className="pt-2 text-center text-[10px] sm:text-xs text-surface-400 border-t border-surface-200/60 mt-2 shrink-0">
                  💡 EVA słucha w tle. Każde pytanie lub wypowiedź dopisuje nową kartę na dole osi czasu.
                </div>

              </div>

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
                onClick={handleCloseAndReset}
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
