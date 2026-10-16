import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2, Star, X } from 'lucide-react';
import type { SentimentLabel, SentimentResult } from '../types/review';
import { SENTIMENT_LABEL } from './labels';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-ink disabled:bg-surface-3 disabled:text-ink-3',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2 disabled:text-ink-3',
  ghost: 'text-ink-2 hover:bg-surface-3 hover:text-ink disabled:text-ink-3',
  danger: 'bg-surface text-neg border border-neg/40 hover:bg-neg-soft disabled:text-ink-3',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }) {
  const sizing = size === 'sm' ? 'h-8 px-2.5 text-[13px] gap-1.5' : 'h-9 px-3.5 text-sm gap-2';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${sizing} ${VARIANTS[variant]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function Card({ title, subtitle, actions, children, className = '' }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, children, actions }: { icon: ReactNode; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-3 text-ink-2">{icon}</div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children && <div className="mt-1.5 max-w-lg text-sm text-ink-2">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= rating ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-line-strong'} aria-hidden />
      ))}
    </span>
  );
}

const SENTIMENT_STYLE: Record<SentimentLabel, string> = {
  positive: 'bg-pos-soft text-pos',
  negative: 'bg-neg-soft text-neg',
  neutral: 'bg-surface-3 text-ink-2',
  uncertain: 'bg-unc-soft text-unc',
};


export function SentimentBadge({ result, showConfidence = true }: { result: SentimentResult; showConfidence?: boolean }) {
  const title = `${result.method === 'ai' ? 'AI' : result.method === 'rating-only' ? 'Stars only' : 'Rule-based'} · ${result.reason}`;
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${SENTIMENT_STYLE[result.label]}`}>
      {SENTIMENT_LABEL[result.label]}
      {showConfidence && <span className="tabular opacity-70">{Math.round(result.confidence * 100)}%</span>}
      {result.method === 'ai' && <span className="rounded bg-current/10 px-1 text-[10px] uppercase">AI</span>}
    </span>
  );
}

export function Badge({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'pos' | 'neg' | 'warn'; title?: string }) {
  const tones = {
    neutral: 'bg-surface-3 text-ink-2',
    brand: 'bg-brand-soft text-brand-ink',
    pos: 'bg-pos-soft text-pos',
    neg: 'bg-neg-soft text-neg',
    warn: 'bg-warn-soft text-warn-ink',
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Chip({ active, onClick, children, count, disabled }: { active: boolean; onClick(): void; children: ReactNode; count?: number; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
        active ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink'
      }`}
    >
      {children}
      {count !== undefined && <span className="tabular text-[11px] opacity-70">{count.toLocaleString()}</span>}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-2">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

/** Accessible modal dialog using the native <dialog> element (focus trap + Esc for free). */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose(): void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? 'max-w-5xl' : 'max-w-xl'} rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-base font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none disabled:bg-surface-3';

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange(v: boolean): void; label: string; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full bg-line-strong p-0.5 transition-colors peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-brand [&>span]:transition-transform peer-checked:[&>span]:translate-x-4">
        <span className="size-4 rounded-full bg-white shadow" />
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-3">{description}</span>}
      </span>
    </label>
  );
}
