import { useState } from 'react';
import { HelpCircle, X, ArrowRight, Lightbulb, CheckCircle2, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHelpButtonProps {
  title: string;
  description: string;
  tips: string[];
  nextStepRecommendation?: {
    text: string;
    path: string;
    actionLabel: string;
  };
  guideSectionId?: string;
}

export default function PageHelpButton({
  title,
  description,
  tips,
  nextStepRecommendation,
  guideSectionId
}: PageHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gold-400 bg-gold-50/90 text-gold-900 hover:bg-gold-600 hover:text-white hover:border-gold-600 text-xs font-semibold transition-all shadow-xs"
        title="Wskazówki i pomoc"
      >
        <HelpCircle className="w-4 h-4 text-gold-700 hover:text-white" />
        <span>Instrukcja i pomoc</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-surface-200 relative max-h-[92vh] flex flex-col">
            
            {/* Nagłówek modalu z bezpiecznie osadzonym przyciskiem zamknięcia */}
            <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-400 to-amber-600 text-white flex items-center justify-center shadow-md shadow-gold-500/20 shrink-0">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-serif font-bold text-surface-900 leading-tight">
                    {title}
                  </h3>
                  <p className="text-xs text-surface-500 mt-0.5">Wskazówki i najlepsze praktyki</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 sm:p-2 rounded-xl text-surface-400 hover:text-surface-900 hover:bg-surface-100 transition-colors shrink-0 -mr-1 -mt-1 cursor-pointer"
                title="Zamknij"
                aria-label="Zamknij pomoc"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Przewijana zawartość dla urządzeń mobilnych */}
            <div className="overflow-y-auto pr-1 flex-1">
              <p className="text-sm text-surface-700 mb-5 leading-relaxed">
                {description}
              </p>

              <div className="mb-5 space-y-2.5 bg-surface-50 p-4 rounded-2xl border border-surface-200">
                <div className="text-xs font-bold text-surface-800 uppercase tracking-wider mb-1">
                  Kluczowe zasady:
                </div>
                {tips.map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-surface-700 leading-normal">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>

              {nextStepRecommendation && (
                <div className="mb-5 p-3.5 sm:p-4 rounded-2xl bg-gold-50 border border-gold-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-xs text-gold-900">
                    <span className="font-bold">Kolejny krok: </span>
                    {nextStepRecommendation.text}
                  </div>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate(nextStepRecommendation.path);
                    }}
                    className="shrink-0 px-3 py-1.5 bg-surface-900 text-white hover:bg-surface-800 hover:text-white text-xs font-medium rounded-xl transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    {nextStepRecommendation.actionLabel} <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Stopka */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-surface-100 text-xs shrink-0">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/dashboard/guide' + (guideSectionId ? `#${guideSectionId}` : ''));
                }}
                className="inline-flex items-center justify-center gap-1.5 text-gold-700 hover:text-gold-950 font-semibold transition-colors py-1.5 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-gold-600" />
                Otwórz pełne Centrum Pomocy
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-surface-900 text-white rounded-xl hover:bg-surface-800 hover:text-white font-medium transition shadow-xs text-center cursor-pointer"
              >
                Rozumiem
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
