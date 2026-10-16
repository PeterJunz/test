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
import { applyScope, SCOPE_LABELS, type Scope } from '../features/filters/scope';
import { buildRuleSummary, computeAspectInsights, computeTagInsights } from '../features/insights/insights';
import { exportReviews, type ExportFormat } from '../features/export/runExport';
import { downloadBlob, safeFileName } from '../services/export/download';

type Source = 'current' | 'selected' | 'preset';

const PRESETS: Array<{ id: string; label: string; filters: ReviewFilters; scope: Scope }> = [
  { id: '5star', label: 'All 5-star reviews', filters: { ...EMPTY_FILTERS, ratings: [5] }, scope: 'all' },
  { id: '1photo', label: '1-star reviews with photos', filters: { ...EMPTY_FILTERS, ratings: [1], hasPhotos: 'yes' }, scope: 'all' },
  { id: 'neg', label: 'Negative reviews', filters: EMPTY_FILTERS, scope: 'negative' },
  { id: 'photos', label: 'All reviews with photos', filters: EMPTY_FILTERS, scope: 'photos' },
  { id: 'us90', label: 'US reviews, last 90 days', filters: { ...EMPTY_FILTERS, countries: ['US'], datePreset: '90' }, scope: 'all' },
];

export function ExportPage({ dataset }: { dataset: Dataset }) {
  const { filters, selection, notify } = useApp();
  const [source, setSource] = useState<Source>('current');
  const [scope, setScope] = useState<Scope>('all');
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [busy, setBusy] = useState<string | null>(null);

  const { reviews, label, effective } = useMemo(() => {
    if (source === 'selected') {
      const list = dataset.reviews.filter((r) => selection.has(r.id));
      return { reviews: list, label: `${list.length} selected reviews`, effective: EMPTY_FILTERS };
    }
    if (source === 'preset') {
      const p = PRESETS.find((x) => x.id === preset)!;
      const eff = applyScope(p.filters, p.scope);
      return { reviews: filterReviews(dataset.reviews, eff), label: p.label, effective: eff };
    }
    const eff = applyScope(filters, scope);
    return { reviews: filterReviews(dataset.reviews, eff), label: `${SCOPE_LABELS[scope]}; ${describeFilters(filters)}`, effective: eff };
  }, [source, scope, preset, filters, selection, dataset.reviews]);

  const run = async (format: ExportFormat) => {
    setBusy(format);
    try {
      await exportReviews(format, reviews, dataset, label);
      notify('success', `Exported ${reviews.length.toLocaleString()} review${reviews.length === 1 ? '' : 's'} as ${format.toUpperCase()}.`);
    } catch (e) {
      notify('error', `Export failed: ${(e as Error).message}`);
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
        filterSummary: source === 'current' ? `${SCOPE_LABELS[scope]}; ${describeFilters(effective)}` : label,
        completeness: dataset.completeness,
        stats: computeStats(reviews),
        tags,
        aspects: computeAspectInsights(reviews),
        ruleSummary: buildRuleSummary(reviews, tags),
        ai: dataset.ai,
      });
      downloadBlob(blob, `${safeFileName(`quality-report-${dataset.productId ?? dataset.name}-${new Date().toISOString().slice(0, 10)}`)}.pdf`);
      notify('success', 'PDF report generated.');
    } catch (e) {
      notify('error', `Report failed: ${(e as Error).message}`);
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
        <h1 className="text-xl font-semibold tracking-tight">Export data</h1>
        <p className="text-sm text-ink-3">Exports contain review content and analysis only — no reviewer names or account data are ever stored.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="1. What to export">
          <div className="space-y-4">
            <div className="space-y-2">
              {radio('current', 'Current filters from the review pages')}
              {source === 'current' && (
                <div className="ml-6 space-y-2">
                  <select className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value as Scope)} aria-label="Scope">
                    {(Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
                      <option key={s} value={s}>
                        {SCOPE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-ink-3">Filters: {describeFilters(filters)}</p>
                </div>
              )}
              {radio('selected', `Selected reviews (${selection.size.toLocaleString()})`, selection.size === 0)}
              {radio('preset', 'Quick preset')}
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
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <strong className="tabular">{reviews.length.toLocaleString()}</strong> reviews will be exported.
            </p>
          </div>
        </Card>

        <Card title="2. Format">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['csv', 'json', 'xlsx'] as ExportFormat[]).map((f) => (
                <Button key={f} variant="primary" loading={busy === f} disabled={!reviews.length || busy !== null} icon={<Download className="size-4" />} onClick={() => run(f)}>
                  {f.toUpperCase()}
                </Button>
              ))}
              <Button loading={busy === 'pdf'} disabled={!reviews.length || busy !== null} icon={<FileText className="size-4" />} onClick={runPdf}>
                PDF quality report
              </Button>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-ink-3">
              <li>CSV/XLSX use the import column names, so an export can be re-imported. Cells starting with = + - @ are escaped to prevent spreadsheet formula injection.</li>
              <li>JSON keeps image/video lists as arrays and includes the selection description.</li>
              <li>The PDF report summarises metrics, themes and (if run) the AI analysis. Built-in PDF fonts cover Latin characters only; other scripts are omitted from quotes.</li>
              {dataset.origin === 'demo' && <li className="font-medium text-warn-ink">Exports of demo data are marked as synthetic in every format.</li>}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
