import { Download, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../hooks/appContext';
import { EMPTY_FILTERS, type ReviewFilters } from '../types/filters';
import type { Dataset } from '../types/review';
import { Button, Card } from '../components/ui';
import { DatasetBanner } from '../components/DatasetBanner';
import { computeStats } from '../features/dashboard/stats';
import { describeFilters } from '../features/filters/describeFilters';
import { filterReviews } from '../features/filters/filterReviews';
import { applyScope, type Scope } from '../features/filters/scope';
import { useI18n, type TFunction } from '../i18n/context';
import { translate } from '../i18n/translate';
import type { MessageKey } from '../i18n/en';
import { buildRuleSummary, computeAspectInsights, computeTagInsights } from '../features/insights/insights';
import { exportReviews, type ExportFormat } from '../features/export/runExport';
import { downloadBlob, safeFileName } from '../services/export/download';

type Source = 'current' | 'selected' | 'preset';

const SCOPES: Scope[] = ['all', 'positive', 'negative', 'photos', 'videos'];

/** Export metadata (file names, selection description, PDF) is always English. */
const tEn: TFunction = (key, vars) => translate('en', key, vars);

const PRESETS: Array<{ id: string; label: MessageKey; filters: ReviewFilters; scope: Scope }> = [
  { id: '5star', label: 'preset.5star', filters: { ...EMPTY_FILTERS, ratings: [5] }, scope: 'all' },
  { id: '1photo', label: 'preset.1photo', filters: { ...EMPTY_FILTERS, ratings: [1], hasPhotos: 'yes' }, scope: 'all' },
  { id: 'neg', label: 'preset.neg', filters: EMPTY_FILTERS, scope: 'negative' },
  { id: 'photos', label: 'preset.photos', filters: EMPTY_FILTERS, scope: 'photos' },
  { id: 'us90', label: 'preset.us90', filters: { ...EMPTY_FILTERS, countries: ['US'], datePreset: '90' }, scope: 'all' },
];

export function ExportPage({ dataset }: { dataset: Dataset }) {
  const { filters, selection, notify } = useApp();
  const { t, lang } = useI18n();
  const [source, setSource] = useState<Source>('current');
  const [scope, setScope] = useState<Scope>('all');
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [busy, setBusy] = useState<string | null>(null);

  const { reviews, label, effective } = useMemo(() => {
    if (source === 'selected') {
      const list = dataset.reviews.filter((r) => selection.has(r.id));
      return { reviews: list, label: tEn('export.selectedLabel', { count: list.length }), effective: EMPTY_FILTERS };
    }
    if (source === 'preset') {
      const p = PRESETS.find((x) => x.id === preset)!;
      const eff = applyScope(p.filters, p.scope);
      return { reviews: filterReviews(dataset.reviews, eff), label: tEn(p.label), effective: eff };
    }
    const eff = applyScope(filters, scope);
    return { reviews: filterReviews(dataset.reviews, eff), label: `${tEn(`scope.${scope}`)}; ${describeFilters(filters, tEn)}`, effective: eff };
  }, [source, scope, preset, filters, selection, dataset.reviews]);

  const run = async (format: ExportFormat) => {
    setBusy(format);
    try {
      await exportReviews(format, reviews, dataset, label);
      notify('success', t('export.done', { count: reviews.length, format: format.toUpperCase() }));
    } catch (e) {
      notify('error', t('export.failed', { detail: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  };

  const runPdf = async () => {
    setBusy('pdf');
    try {
      const { buildPdfReport } = await import('../services/export/pdf');
      const tags = computeTagInsights(reviews);
      const blob = await buildPdfReport({
        datasetName: dataset.name,
        origin: dataset.origin,
        productId: dataset.productId,
        filterSummary: source === 'current' ? `${tEn(`scope.${scope}`)}; ${describeFilters(effective, tEn)}` : label,
        completeness: dataset.completeness,
        stats: computeStats(reviews),
        tags,
        aspects: computeAspectInsights(reviews),
        ruleSummary: buildRuleSummary(reviews, tags),
        ai: dataset.ai,
      });
      downloadBlob(blob, `${safeFileName(`quality-report-${dataset.productId ?? dataset.name}-${new Date().toISOString().slice(0, 10)}`)}.pdf`);
      notify('success', t('export.pdfDone'));
    } catch (e) {
      notify('error', t('export.pdfFailed', { detail: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  };

  const radio = (value: Source, text: string, disabled = false) => (
    <label className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
      <input type="radio" name="export-source" className="accent-[var(--brand)]" checked={source === value} disabled={disabled} onChange={() => setSource(value)} />
      {text}
    </label>
  );

  return (
    <div className="space-y-5">
      <DatasetBanner dataset={dataset} />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('nav.export')}</h1>
        <p className="text-sm text-ink-3">{t('export.subtitle')}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={t('export.what')}>
          <div className="space-y-4">
            <div className="space-y-2">
              {radio('current', t('export.current'))}
              {source === 'current' && (
                <div className="ml-6 space-y-2">
                  <select className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value as Scope)} aria-label={t('export.scope')}>
                    {SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {t(`scope.${s}`)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-ink-3">{t('export.filtersLine', { desc: describeFilters(filters, t, lang) })}</p>
                </div>
              )}
              {radio('selected', t('export.selected', { count: selection.size }), selection.size === 0)}
              {radio('preset', t('export.preset'))}
              {source === 'preset' && (
                <div className="ml-6 flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPreset(p.id)}
                      aria-pressed={preset === p.id}
                      className={`rounded-full border px-2.5 py-1 text-xs ${preset === p.id ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line text-ink-2 hover:text-ink'}`}
                    >
                      {t(p.label)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
              {t('export.willExport', { count: reviews.length })}
            </p>
          </div>
        </Card>

        <Card title={t('export.format')}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['csv', 'json', 'xlsx'] as ExportFormat[]).map((f) => (
                <Button key={f} variant="primary" loading={busy === f} disabled={!reviews.length || busy !== null} icon={<Download className="size-4" />} onClick={() => run(f)}>
                  {f.toUpperCase()}
                </Button>
              ))}
              <Button loading={busy === 'pdf'} disabled={!reviews.length || busy !== null} icon={<FileText className="size-4" />} onClick={runPdf}>
                {t('export.pdf')}
              </Button>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-ink-3">
              <li>{t('export.noteCsv')}</li>
              <li>{t('export.noteJson')}</li>
              <li>{t('export.notePdf')}</li>
              {dataset.origin === 'demo' && <li className="font-medium text-warn-ink">{t('export.noteDemo')}</li>}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
