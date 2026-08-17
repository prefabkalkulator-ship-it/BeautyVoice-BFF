import { useEffect, useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Pencil } from 'lucide-react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export default function Faq() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  if (loading) {
    return <div className="p-8 text-surface-500 animate-pulse">Ładowanie bazy wiedzy...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-surface-900 tracking-tight">Baza Wiedzy (FAQ)</h2>
          <p className="text-surface-500 mt-1">Konfiguruj wiedzę asystenta – to z niej czerpie odpowiedzi na pytania klientów.</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-surface-800 transition-colors shadow-sm self-start md:self-auto">
          Dodaj wpis
        </button>
      </div>

      <div className="space-y-4">
        {faqs.map(faq => {
          const isExpanded = expandedId === faq.id;
          return (
            <div 
              key={faq.id} 
              className="glass-card glass-card-hover rounded-2xl p-6 relative group cursor-pointer transition-all"
              onClick={() => setExpandedId(isExpanded ? null : faq.id)}
            >
              <div className="flex gap-4">
                <div className="mt-1">
                  <div className="bg-gold-50 p-2 rounded-lg text-gold-600 border border-gold-100">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium text-surface-900 pr-8">{faq.question}</h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); /* logic edit */ }}
                        className="text-surface-300 hover:text-gold-600 p-1 bg-surface-50 hover:bg-gold-50 rounded transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-surface-400" /> : <ChevronDown className="w-5 h-5 text-surface-400" />}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-surface-100 animate-in fade-in slide-in-from-top-2 duration-300">
                      <p className="text-surface-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
