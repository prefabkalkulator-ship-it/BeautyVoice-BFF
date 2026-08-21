import { useEffect, useState, useRef } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Pencil, Sparkles, Loader2, X, ShieldAlert, Mic, Square, Plus, Database, Trash2, Check } from 'lucide-react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export default function Faq() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'teach' | 'advanced'>('teach');

  // Stan edycji in-line
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');

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

  const fetchFaqs = () => {
    fetch('/api/faq')
      .then(res => res.json())
      .then(data => {
        setFaqs(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchFaqs();
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

      const res = await fetch('/api/knowledge/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Błąd serwera przy analizie.');
      }
      
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
        body: JSON.stringify({ question: editQuestion, answer: editAnswer })
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Wiedza dla EVA</h2>
          <p className="text-surface-500 mt-1">Ucz swoją asystentkę zasad działania Twojego salonu.</p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto bg-surface-100 p-1 rounded-xl">
          <button 
            onClick={() => setViewMode('teach')}
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

      {viewMode === 'teach' && (
        <div className="glass-card rounded-3xl p-6 md:p-10 relative overflow-hidden shadow-sm border border-surface-200/60 animate-in fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gold-100 text-gold-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-serif text-surface-900">Cześć! Jestem EVA.</h3>
              <p className="text-surface-500 text-sm">
                Wklej tutaj swój cennik, wrzuć zdjęcie ulotki lub po prostu kliknij mikrofon i opowiedz mi o swoim salonie.
                Jako Twoja wirtualna asystentka przetworzę te dane i nauczę się, jak wyceniać usługi przed klientami.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl text-sm border border-red-100 flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
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
                  className="w-full h-48 md:h-64 p-6 pt-16 bg-white/60 backdrop-blur-sm border-2 border-dashed border-surface-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-400 resize-none transition-all group-hover:border-gold-300"
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
                  {isExtracting ? 'Analizuję moje nowe dane...' : 'Wygeneruj wiedzę dla EVA'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
              <div className="bg-green-50 text-green-800 p-4 rounded-2xl border border-green-200 font-medium">
                Przetworzyłam! Zrozumiałam {extractedData.services?.length || 0} usług i opracowałam {extractedData.faq?.length || 0} pytań FAQ.
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
                      const tenantId = '00000000-0000-0000-0000-000000000000';
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
                  className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-medium hover:bg-surface-800 transition-colors shadow-sm"
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
          <div className="glass-card p-6 rounded-3xl mb-6 bg-gradient-to-r from-surface-900 to-surface-800 text-white flex justify-between items-center shadow-lg">
             <div>
               <h3 className="text-xl font-serif">Wyuczona Baza Wiedzy</h3>
               <p className="text-surface-300 text-sm mt-1">Zarządzaj odpowiedziami, które pamiętam na pamięć.</p>
             </div>
             <button 
                onClick={() => {
                   const newFaq = { id: `new-${Date.now()}`, question: '', answer: '' };
                   setFaqs([newFaq, ...faqs]);
                   setEditingId(newFaq.id);
                   setEditQuestion(newFaq.question);
                   setEditAnswer(newFaq.answer);
                   setExpandedId(newFaq.id);
                }}
                className="bg-white text-surface-900 hover:bg-surface-100 px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
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
                <div className="flex gap-4">
                  <div className="mt-1">
                    <div className="bg-gold-50 p-2 rounded-lg text-gold-600 border border-gold-100">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex-1 w-full">
                    <div className="flex justify-between items-start w-full">
                      {!isEditing ? (
                        <h3 className="text-lg font-medium text-surface-900 pr-8">{faq.question}</h3>
                      ) : (
                        <div className="flex-1"></div>
                      )}
                      
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
                    
                    {isEditing && (
                      <div className="mt-2 w-full">
                        <input 
                          type="text" 
                          value={editQuestion} 
                          onChange={(e) => setEditQuestion(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Wpisz pytanie..."
                          className="text-lg font-medium text-surface-900 w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
                        />
                      </div>
                    )}
                    
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-surface-100 animate-in fade-in slide-in-from-top-2 duration-300">
                        {isEditing ? (
                          <textarea 
                            value={editAnswer} 
                            onChange={(e) => setEditAnswer(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            rows={3}
                            placeholder="Wpisz odpowiedź..."
                            className="w-full bg-surface-50 border border-surface-200 rounded-lg p-3 text-surface-800 focus:outline-none focus:ring-2 focus:ring-gold-500/50 resize-none"
                          />
                        ) : (
                          <p className="text-surface-600 leading-relaxed"><span className="font-bold text-surface-800">EVA:</span> {faq.answer}</p>
                        )}
                      </div>
                    )}
                  </div>
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
