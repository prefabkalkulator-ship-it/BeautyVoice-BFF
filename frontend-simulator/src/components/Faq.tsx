import PageHelpButton from './common/PageHelpButton';
import { useEffect, useState, useRef } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Pencil, Sparkles, Loader2, X, ShieldAlert, Mic, Square, Plus, Database, Trash2, Check, AlertCircle, Lock } from 'lucide-react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  isConfidential?: boolean;
}

const FAQ_LIMIT = 150;

export default function Faq() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'teach' | 'advanced'>('teach');

  // Stan edycji in-line
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editIsConfidential, setEditIsConfidential] = useState(false);

  // Stan asystenta (Ucz mnie)
  const [rawText, setRawText] = useState('');
  const [fileData, setFileData] = useState<{ base64: string, mime: string, name: string } | null>(null);
  
  // Nagrywanie głosu
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [error, setError] = useState('');

  const [businessProfile, setBusinessProfile] = useState('solo');
  const [botName, setBotName] = useState('EVA');
  const [isPremium, setIsPremium] = useState(false);

  const fetchFaqs = () => {
    fetch('/api/faq')
      .then(res => res.json())
      .then(data => {
        setFaqs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchFaqs();
    fetch('/api/tenant')
      .then(res => res.json())
      .then(t => {
        if (t) {
          setBusinessProfile(t.businessProfile || 'solo');
          if (t.botName) setBotName(t.botName);
        }
      })
      .catch(err => console.error('Failed to load tenant in Faq:', err));

    fetch('/api/subscription')
      .then(res => res.json())
      .then(s => {
        if (s?.planName?.toLowerCase() === 'premium') {
          setIsPremium(true);
        }
      })
      .catch(err => console.error('Failed to load subscription in Faq:', err));
  }, []);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            setFileData({ 
              base64: reader.result as string, 
              mime: 'audio/webm', 
              name: 'Nagranie głosowe' 
            });
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err: any) {
      setError('Nie uzyskano dostępu do mikrofonu: ' + err.message);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleExtract = async () => {
    if (!rawText.trim() && !fileData) return;
    setIsExtracting(true);
    setError('');
    try {
      const payload: any = {};
      if (rawText.trim()) payload.rawText = rawText;
      if (fileData) {
        payload.fileData = fileData.base64;
        payload.mimeType = fileData.mime;
      }

      // Bezpośrednie wywołanie backendu na Cloud Run eliminuje 60-sekundowy limit Firebase Hosting
      const isCloudHosted = typeof window !== 'undefined' && (window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com'));
      const directUrl = 'https://beautyvoice-bff-739272851032.europe-central2.run.app/api/knowledge/extract';
      const extractUrl = isCloudHosted ? directUrl : '/api/knowledge/extract';

      let res: Response;
      try {
        res = await fetch(extractUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (directErr) {
        // Fallback do względnego endpointu /api/ w razie specyficznych blokad sieciowych
        res = await fetch('/api/knowledge/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        let errMsg = `Błąd serwera (${res.status})`;
        try {
          const errData = await res.json();
          if (errData.error) errMsg = errData.error;
        } catch (_) {
          if (res.status === 502 || res.status === 504) {
            errMsg = 'Przekroczono limit czasu bramy sieciowej (timeout 60s). Przetwarzanie trwało zbyt długo. Podziel plik na mniejsze części lub wgraj ponownie – zoptymalizowaliśmy silnik!';
          }
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      setExtractedData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.includes('text') || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (evt.target?.result) {
            setRawText((prev) => prev + (prev ? '\n\n' : '') + evt.target!.result);
          }
        };
        reader.readAsText(file);
      } else if (file.type === 'application/pdf' || file.type.startsWith('audio/') || file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (evt.target?.result) {
            setFileData({ base64: evt.target.result as string, mime: file.type, name: file.name });
          }
        };
        reader.readAsDataURL(file);
      } else {
        setError('Rozpoznaję tylko pliki tekstowe, PDF, pliki audio i zdjęcia.');
      }
    }
  };

  const startEditing = (faq: FaqItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(faq.id);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer);
    setEditIsConfidential(Boolean(faq.isConfidential));
    setExpandedId(faq.id);
  };

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId) return;
    try {
      const isNew = editingId.startsWith('new-');
      const url = isNew ? '/api/faq' : `/api/faq/${editingId}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: editQuestion, answer: editAnswer, isConfidential: editIsConfidential })
      });
      if (res.ok) {
        const savedData = await res.json();
        setFaqs(prev => prev.map(f => f.id === editingId ? savedData : f));
        setEditingId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteFaq = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id.startsWith('new-')) {
      setFaqs(prev => prev.filter(f => f.id !== id));
      return;
    }
    if (!confirm('Na pewno usunąć ten wpis?')) return;
    try {
      const res = await fetch(`/api/faq/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFaqs(prev => prev.filter(f => f.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-8 text-surface-500 animate-pulse">Ładowanie bazy wiedzy...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl relative w-full min-w-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif text-surface-900 tracking-tight">
              {businessProfile === 'personal' ? 'Baza Wiedzy Asystenta' : `Wiedza dla ${botName}`}
            </h2>
            <PageHelpButton
              title="Jak uczyć asystenta w Bazie Wiedzy?"
              description={
                businessProfile === 'personal'
                  ? "Baza wiedzy to zbiór informacji merytorycznych, zasad współpracy, specjalizacji i procedur, którymi posługuje się Twój asystent podczas rozmowy z dzwoniącymi."
                  : `Baza wiedzy to zbiór informacji, którymi posługuje się ${botName} podczas rozmowy z Twoimi klientami.`
              }
              tips={
                businessProfile === 'personal'
                  ? [
                      "Wprowadzaj wiedzę merytoryczną: zakres prowadzonych spraw, wymagane dokumenty, zasady wyceny konsultacji, godziny kontaktu czy procedury awaryjne.",
                      "Wiedza Poufna (PIN): Zaznacz 'Poufne' przy dowolnym pytaniu, aby zabezpieczyć odpowiedź kodem PIN (domyślnie 7777, do zmiany w Ustawieniach). Asystent nigdy nie poda jej przypadkowemu rozmówcy.",
                      "Użyj zakładki 'Ucz mnie', aby wgrać plik PDF/tekstowy lub podyktować zasady głosem – AI automatycznie utworzy zestaw konkretnych pytań i odpowiedzi.",
                      "W zakładce 'Baza Wyuczona' możesz w każdej chwili przejrzeć, edytować lub ręcznie dodać dowolną odpowiedź."
                    ]
                  : [
                      "Wklejaj zasady firmy: metody płatności, politykę spóźnień, parking, dojazd czy warunki realizacji usług.",
                      "Wiedza Poufna (PIN): Zaznacz 'Poufne' przy pytaniu, aby zabezpieczyć wrażliwe informacje kodem PIN (domyślnie 7777).",
                      "Użyj zakładki 'Ucz mnie', aby wgrać plik PDF/tekstowy lub podyktować zasady głosem – AI automatycznie utworzy zwięzłe pytania i odpowiedzi.",
                      "W zakładce 'Baza Wyuczona' możesz w każdej chwili przejrzeć i ręcznie poprawić dowolną odpowiedź."
                    ]
              }
              guideSectionId={businessProfile === 'personal' ? 'personal-confidential-knowledge' : 'faq-training'}
              nextStepRecommendation={
                businessProfile === 'personal'
                  ? {
                      text: "Przejdź do Ustawień, aby dostosować harmonogram i strefy dostępności",
                      path: "/dashboard/settings",
                      actionLabel: "Przejdź do Ustawień"
                    }
                  : {
                      text: "Przejdź do Usług i Cennika, aby zweryfikować wykryte przez AI pozycje",
                      path: "/dashboard/services",
                      actionLabel: "Przejdź do Usług"
                    }
              }
              guideSectionId="faq-training"
            />
          </div>
          <p className="text-surface-500 mt-1">
            {businessProfile === 'personal'
              ? "Ucz asystenta wiedzy merytorycznej, procedur i zasad obsługi dzwoniących."
              : "Ucz swoją asystentkę zasad działania Twojej firmy."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <div className="bg-surface-100/80 border border-surface-200 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs">
            <span className="text-surface-500 font-medium">Baza Q&A:</span>
            <span className={`font-bold px-2 py-0.5 rounded-md ${
              !isPremium && faqs.length >= FAQ_LIMIT
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-white text-surface-900 shadow-2xs'
            }`}>
              {faqs.length} / {isPremium ? 'Bez limitu' : FAQ_LIMIT}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-xl">
            <button 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'teach' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}
            >
              <Sparkles className="w-4 h-4" />
              Ucz mnie
            </button>
            <button 
              onClick={() => setViewMode('advanced')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'advanced' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}
            >
              <Database className="w-4 h-4" />
              Baza Wyuczona
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'teach' && (
        <div className="glass-card rounded-3xl p-6 md:p-10 relative overflow-hidden shadow-sm border border-surface-200/60 animate-in fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gold-100 text-gold-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-serif text-surface-900">
                {businessProfile === 'personal' ? 'Cześć! Jestem Twoim Asystentem Osobistym.' : `Cześć! Jestem ${botName}.`}
              </h3>
              <p className="text-surface-500 text-sm">
                {businessProfile === 'personal'
                  ? "Wklej tutaj zasady współpracy, procedury, opis swojej specjalizacji lub po prostu kliknij mikrofon i opowiedz mi o swoim stylu pracy. Przetworzę te dane i nauczę się, jak profesjonalnie odpowiadać na pytania dzwoniących."
                  : "Wklej tutaj swój cennik, wrzuć zdjęcie ulotki lub po prostu kliknij mikrofon i opowiedz mi o swoim biznesie. Jako Twoja wirtualna asystentka przetworzę te dane i nauczę się, jak wyceniać usługi przed klientami."}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl text-sm border border-red-100 flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isPremium && faqs.length >= FAQ_LIMIT && (
            <div className="mb-6 p-4 bg-amber-50 text-amber-800 rounded-2xl text-sm border border-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Osiągnięto limit {FAQ_LIMIT} pytań i odpowiedzi (Q&A)</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  W Twoim bieżącym pakiecie możesz zapisać maksymalnie {FAQ_LIMIT} wpisów wiedzy. Przejdź do zakładki "Baza Wyuczona", aby usunąć nieaktualne wpisy lub przejdź na pakiet Premium, aby uczyć asystenta bez limitów.
                </p>
              </div>
            </div>
          )}

          {!extractedData ? (
            <div className="space-y-6">
              <div className="relative group">
                <textarea 
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) {
                       handleFileUpload({ target: { files: [file] } } as any);
                    }
                  }}
                  placeholder="Skopiuj tekst, upuść plik lub zacznij pisać..."
                  className="w-full h-48 md:h-64 p-6 pt-[80px] md:pt-16 bg-white/60 backdrop-blur-sm border-2 border-dashed border-surface-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-400 resize-none transition-all group-hover:border-gold-300"
                />
                
                {/* Ozdobny plus i narzędzia zagnieżdżone w polu */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <div className="relative">
                     <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
                     <button className="bg-surface-100 hover:bg-gold-50 text-surface-600 hover:text-gold-600 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                       <Plus className="w-5 h-5" />
                       Wybierz plik
                     </button>
                  </div>
                  
                  <button 
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${isRecording ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' : 'bg-surface-900 text-white hover:bg-surface-800'}`}
                  >
                    {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isRecording ? 'Zakończ dyktowanie' : 'Nagraj głosem'}
                  </button>
                </div>

                {fileData && (
                  <div className="absolute bottom-4 left-4 bg-gold-50 text-gold-700 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-3 border border-gold-200 shadow-sm">
                    <span className="truncate max-w-[200px]">{fileData.name}</span>
                    <button onClick={() => setFileData(null)} className="hover:bg-gold-200 p-1 rounded-md transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={handleExtract}
                  disabled={isExtracting || (!rawText.trim() && !fileData)}
                  className="bg-primary text-primary-foreground px-8 py-3.5 rounded-2xl font-medium hover:bg-surface-800 hover:text-white transition-all shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:hover:shadow-none"
                >
                  {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {isExtracting 
                    ? 'Analizuję moje nowe dane...' 
                    : (businessProfile === 'personal' ? 'Wygeneruj wiedzę dla asystenta' : `Wygeneruj wiedzę dla ${botName}`)}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
              <div className="bg-green-50 text-green-800 p-4 rounded-2xl border border-green-200 font-medium">
                {businessProfile === 'personal'
                  ? `Przetworzyłam! Opracowałam ${extractedData.faq?.length || 0} wpisów bazy wiedzy dla asystenta.`
                  : `Przetworzyłam! Zrozumiałam ${extractedData.services?.length || 0} usług i opracowałam ${extractedData.faq?.length || 0} pytań FAQ.`}
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                {extractedData.services && extractedData.services.length > 0 && (
                  <div className="bg-white p-5 rounded-2xl border border-surface-100 shadow-sm">
                    <h4 className="font-serif text-lg text-surface-900 mb-4">Wykryte usługi</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                      {extractedData.services.map((s: any, i: number) => (
                        <div key={i} className="bg-surface-50 p-3 rounded-xl text-sm flex justify-between border border-surface-100">
                          <span className="font-medium text-surface-900">{s.name}</span>
                          <span className="text-surface-500 font-medium">{s.price} zł ({s.durationMinutes} min)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {extractedData.faq && extractedData.faq.length > 0 && (
                  <div className="bg-white p-5 rounded-2xl border border-surface-100 shadow-sm">
                    <h4 className="font-serif text-lg text-surface-900 mb-4">Pytania pomocnicze (FAQ)</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {extractedData.faq.map((f: any, i: number) => (
                        <div key={i} className="bg-surface-50 p-4 rounded-xl text-sm border border-surface-100">
                          <div className="font-medium text-surface-900 mb-1 flex gap-2">
                            <span className="text-gold-600 font-bold">Q:</span> {f.question}
                          </div>
                          <div className="text-surface-600 flex gap-2 mt-2">
                            <span className="text-primary font-bold">EVA:</span> {f.answer}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
                <button 
                  onClick={() => setExtractedData(null)} 
                  className="px-6 py-3 text-surface-600 font-medium hover:bg-surface-100 rounded-xl transition-colors"
                >
                  Wróć i popraw
                </button>
                <button 
                  onClick={async () => {
                    try {
                      // Tymczasowo sztywne ID salonu (później zastąpimy to ID z autoryzacji)
                      const tenantId = localStorage.getItem('tenantId') || '00000000-0000-0000-0000-000000000000';
                      const res = await fetch('/api/knowledge/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          services: extractedData.services,
                          faq: extractedData.faq,
                          tenantId
                        })
                      });
                      if (!res.ok) throw new Error('Błąd zapisu bazy');
                      
                      setExtractedData(null);
                      setRawText('');
                      setFileData(null);
                      fetchFaqs();
                      setViewMode('advanced');
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                  className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-medium hover:bg-surface-800 hover:text-white transition-colors shadow-sm"
                >
                  Zapisz i naucz mnie
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'advanced' && (
        <div className="space-y-4 animate-in slide-in-from-right-4">
          {!isPremium && faqs.length >= FAQ_LIMIT && (
            <div className="p-4 bg-amber-50 text-amber-800 rounded-2xl text-sm border border-amber-200 flex items-start gap-2.5 shadow-xs">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Osiągnięto limit {FAQ_LIMIT} wpisów Q&A</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Aby dodać nowe pytania i odpowiedzi, usuń niepotrzebne wpisy lub przejdź na pakiet Premium.
                </p>
              </div>
            </div>
          )}

          <div className="glass-card p-6 rounded-3xl mb-6 bg-gradient-to-r from-surface-900 to-surface-800 text-white flex justify-between items-center shadow-lg">
             <div>
               <h3 className="text-xl font-serif">Wyuczona Baza Wiedzy</h3>
               <p className="text-surface-300 text-sm mt-1">Zarządzaj odpowiedziami, które pamiętam na pamięć.</p>
             </div>
             <button 
                disabled={!isPremium && faqs.length >= FAQ_LIMIT}
                onClick={() => {
                   if (!isPremium && faqs.length >= FAQ_LIMIT) return;
                   const newFaq: FaqItem = { id: `new-${Date.now()}`, question: '', answer: '', isConfidential: false };
                   setFaqs([newFaq, ...faqs]);
                   setEditingId(newFaq.id);
                   setEditQuestion(newFaq.question);
                   setEditAnswer(newFaq.answer);
                   setEditIsConfidential(false);
                   setExpandedId(newFaq.id);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm ${
                  !isPremium && faqs.length >= FAQ_LIMIT
                    ? 'bg-surface-700 text-surface-400 cursor-not-allowed opacity-60'
                    : 'bg-white text-surface-900 hover:bg-surface-100 cursor-pointer'
                }`}
                title={!isPremium && faqs.length >= FAQ_LIMIT ? `Osiągnięto limit ${FAQ_LIMIT} wpisów` : undefined}
             >
               Ręcznie dodaj wpis
             </button>
          </div>
          
          {faqs.map(faq => {
            const isExpanded = expandedId === faq.id;
            const isEditing = editingId === faq.id;
            
            return (
              <div 
                key={faq.id} 
                className={`glass-card rounded-2xl p-6 relative group transition-all border border-surface-200/50 ${!isEditing ? 'glass-card-hover cursor-pointer' : ''}`}
                onClick={() => { if (!isEditing) setExpandedId(isExpanded ? null : faq.id); }}
              >
                <div className="flex flex-col w-full gap-3">
                  <div className="flex justify-between items-start w-full">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-gold-50 p-2 rounded-lg text-gold-600 border border-gold-100 shrink-0">
                        <HelpCircle className="w-5 h-5" />
                      </div>
                      {faq.isConfidential && !isEditing && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100/90 text-amber-900 border border-amber-300/80 shadow-2xs">
                          <Lock className="w-3.5 h-3.5 text-amber-700" />
                          Poufne (wymaga PIN)
                        </span>
                      )}
                    </div>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} className="text-green-600 p-2 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"><Check className="w-4 h-4" /></button>
                            <button onClick={(e) => deleteFaq(faq.id, e)} className="text-red-500 p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-surface-500 p-2 bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <button 
                            onClick={(e) => startEditing(faq, e)}
                            className="text-surface-300 hover:text-gold-600 p-2 bg-surface-50 hover:bg-gold-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {!isEditing && (isExpanded ? <ChevronUp className="w-5 h-5 text-surface-400" /> : <ChevronDown className="w-5 h-5 text-surface-400" />)}
                      </div>
                  </div>
                  
                  <div className="w-full">
                      {!isEditing ? (
                        <h3 className="text-lg font-medium text-surface-900 w-full">{faq.question}</h3>
                      ) : (
                        <input 
                          type="text" 
                          value={editQuestion} 
                          onChange={(e) => setEditQuestion(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Wpisz pytanie..."
                          className="text-lg font-medium text-surface-900 w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                        />
                      )}
                  </div>
                    
                  {isExpanded && (
                      <div className="mt-2 pt-4 border-t border-surface-100 animate-in fade-in slide-in-from-top-2 duration-300 w-full">
                        {isEditing ? (
                          <div className="space-y-3">
                            <textarea 
                              value={editAnswer} 
                              onChange={(e) => setEditAnswer(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              rows={3}
                              placeholder="Wpisz odpowiedź..."
                              className="w-full bg-surface-50 border border-surface-200 rounded-lg p-3 text-surface-800 focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
                            />
                            <div className="pt-2 border-t border-surface-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <label className="inline-flex items-center gap-2 text-xs font-bold text-surface-800 cursor-pointer select-none bg-amber-50/80 border border-amber-200 px-3 py-2 rounded-xl">
                                  <input 
                                    type="checkbox"
                                    checked={editIsConfidential}
                                    onChange={(e) => setEditIsConfidential(e.target.checked)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 rounded text-amber-600 accent-amber-600 border-surface-300"
                                  />
                                  <span className="flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                                    Oznacz jako wiedzę poufną (wymaga podania PIN przez dzwoniącego)
                                  </span>
                                </label>
                                <PageHelpButton
                                  variant="circle_i"
                                  title="Wiedza Poufna z kodem PIN"
                                  description="Oznaczenie pytania jako poufne ukrywa treść odpowiedzi przed zwykłymi dzwoniącymi. Asystent odczyta tę odpowiedź wyłącznie po poprawnym podaniu kodu PIN."
                                  tips={[
                                    "Domyślny PIN dostępu to 7777 (możesz go zmienić w Ustawieniach Asystenta w sekcji Baza Wiedzy Poufnej).",
                                    "PIN do wiedzy poufnej jest całkowicie niezależny od głównego PIN-u Właściciela.",
                                    "Gdy rozmówca zapyta o to zagadnienie, asystent poinformuje, że treść wymaga autoryzacji kodem PIN.",
                                    "Po podaniu PIN-u asystent natychmiast odblokowuje odpowiedź i utrzymuje dostęp do końca połączenia."
                                  ]}
                                  guideSectionId={businessProfile === 'personal' ? 'personal-confidential-knowledge' : 'faq-training'}
                                />
                              </div>
                              <span className="text-[11px] text-surface-500">
                                Asystent nie odczyta tej odpowiedzi bez podania kodu PIN.
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-surface-600 leading-relaxed w-full"><span className="font-bold text-surface-800">EVA:</span> {faq.answer}</p>
                        )}
                      </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {faqs.length === 0 && (
             <div className="text-center py-12 text-surface-500 glass-card rounded-3xl">
               Nie nauczyłaś/eś mnie jeszcze żadnych pytań. Przejdź do zakładki "Ucz mnie".
             </div>
          )}
        </div>
      )}
    </div>
  );
}
