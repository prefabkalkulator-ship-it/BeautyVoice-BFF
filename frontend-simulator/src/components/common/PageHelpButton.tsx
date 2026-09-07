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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gold-300/80 bg-gold-50/70 text-gold-800 hover:bg-gold-100 hover:border-gold-400 text-xs font-semibold transition-all shadow-xs"
        title="Wskazówki i pomoc"
      >
        <HelpCircle className="w-4 h-4 text-gold-600" />
        <span>Instrukcja i pomoc</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-surface-200 relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-400 to-amber-600 text-white flex items-center justify-center shadow-md shadow-gold-500/20 shrink-0">
                <Lightbulb className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-surface-900 leading-tight">
                  {title}
                </h3>
                <p className="text-xs text-surface-500 mt-0.5">Wskazówki i najlepsze praktyki</p>
              </div>
            </div>

            <p className="text-sm text-surface-700 mb-5 leading-relaxed">
              {description}
            </p>

            <div className="mb-6 space-y-2.5 bg-surface-50 p-4 rounded-2xl border border-surface-200">
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
              <div className="mb-6 p-4 rounded-2xl bg-gold-50 border border-gold-200 flex items-center justify-between gap-3">
                <div className="text-xs text-gold-900">
                  <span className="font-bold">Kolejny krok: </span>
                  {nextStepRecommendation.text}
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate(nextStepRecommendation.path);
                  }}
                  className="shrink-0 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-xl hover:bg-surface-800 transition flex items-center gap-1"
                >
                  {nextStepRecommendation.actionLabel} <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-surface-100 text-xs">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/dashboard/guide' + (guideSectionId ? `#${guideSectionId}` : ''));
                }}
                className="inline-flex items-center gap-1.5 text-gold-700 hover:text-gold-900 font-semibold transition-colors"
              >
                <BookOpen className="w-4 h-4 text-gold-600" />
                Otwórz pełne Centrum Pomocy
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-surface-100 text-surface-800 rounded-xl hover:bg-surface-200 font-medium transition"
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
