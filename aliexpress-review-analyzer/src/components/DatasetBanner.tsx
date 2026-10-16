import { AlertTriangle, FlaskConical, Info } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/context';
import type { Dataset } from '../types/review';

export function DatasetBanner({ dataset }: { dataset: Dataset }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      {dataset.origin === 'demo' && (
        <div role="note" className="flex items-start gap-2.5 rounded-xl border border-warn-ink/30 bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong>{t('banner.demoTitle')}</strong> {t('banner.demoBody')}
          </p>
        </div>
      )}
      {dataset.completeness !== 'complete' && dataset.origin !== 'demo' && (
        <div role="note" className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn-ink" aria-hidden />
          <p>{t(dataset.completeness === 'partial' ? 'banner.partial' : 'banner.unknown')}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
        <span>
          {t('banner.source')} <span className="text-ink-2">{t(`origin.${dataset.origin}`)}</span> · {dataset.sourceLabel}
        </span>
        {dataset.productId && (
          <span>
            {t('banner.productId')} <span className="tabular text-ink-2">{dataset.productId}</span>
          </span>
        )}
        <span>{t('banner.loaded', { time: new Date(dataset.createdAt).toLocaleString() })}</span>
        {dataset.notes.length > 0 && (
          <button type="button" className="inline-flex items-center gap-1 text-ink-2 underline-offset-2 hover:underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <Info className="size-3.5" aria-hidden /> {t(open ? 'banner.hideNotes' : 'banner.showNotes', { count: dataset.notes.length })}
          </button>
        )}
      </div>
      {open && (
        <ul className="list-disc space-y-1 rounded-lg bg-surface-2 py-2 pl-8 pr-4 text-xs text-ink-2">
          {dataset.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
