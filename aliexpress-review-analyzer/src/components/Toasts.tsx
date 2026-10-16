import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useApp } from '../hooks/appContext';

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info;
        return (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3 text-sm shadow-lg">
            <Icon className={`mt-0.5 size-4 shrink-0 ${t.kind === 'success' ? 'text-ok' : t.kind === 'error' ? 'text-neg' : 'text-pos'}`} aria-hidden />
            <p className="flex-1 text-ink">{t.message}</p>
            <button type="button" onClick={() => dismissToast(t.id)} className="text-ink-3 hover:text-ink" aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
