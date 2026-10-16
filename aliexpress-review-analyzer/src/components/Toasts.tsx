import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useApp } from '../hooks/appContext';
import { useI18n } from '../i18n/context';

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  const { t } = useI18n();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? XCircle : Info;
        return (
          <div key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3 text-sm shadow-lg">
            <Icon className={`mt-0.5 size-4 shrink-0 ${toast.kind === 'success' ? 'text-ok' : toast.kind === 'error' ? 'text-neg' : 'text-pos'}`} aria-hidden />
            <p className="flex-1 text-ink">{toast.message}</p>
            <button type="button" onClick={() => dismissToast(toast.id)} className="text-ink-3 hover:text-ink" aria-label={t('common.dismiss')}>
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
