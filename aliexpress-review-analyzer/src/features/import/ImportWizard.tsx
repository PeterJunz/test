import { AlertTriangle, CheckCircle2, Download, FileUp, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useApp } from '../../hooks/appContext';
import type { Dataset } from '../../types/review';
import { autoDetectMapping, CANONICAL_FIELDS, missingRequired, REQUIRED_FIELDS, type CanonicalField, type FieldMapping } from '../../services/review-normalizer/fields';
import { normalizeRows, type ImportReport, type SkipReason, type WarningKind } from '../../services/review-normalizer/normalize';
import { ImportError, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseImportFile, type ParsedFile } from '../../services/review-normalizer/parse';
import { downloadBlob } from '../../services/export/download';
import { randomId } from '../../utils/hash';
import { parseProductInput } from '../../utils/url';
import type { DateOrder } from '../../utils/date';
import { Button, Field, inputClass } from '../../components/ui';
import { useI18n } from '../../i18n/context';
import { productInputErrorText } from '../../hooks/useAnalyze';

const TEMPLATE = [
  'rating,review_text,review_date,reviewer_country,product_variant,review_images,review_video,source_url',
  '5,"EXAMPLE ROW – replace with your data",2026-01-15,US,Color: Black,https://example.com/photo1.jpg | https://example.com/photo2.jpg,,',
  '1,"EXAMPLE ROW – stopped working after 3 days",2026-02-02,GB,Color: White,,,',
].join('\r\n');

function previewCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

export function ImportWizard() {
  const { saveDataset, setActiveDataset, navigate, notify, pendingProductId, setPendingProductId } = useApp();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [name, setName] = useState('');
  const [product, setProduct] = useState(pendingProductId ?? '');
  const [dateOrder, setDateOrder] = useState<DateOrder>('MDY');
  const [ratingScale, setRatingScale] = useState<'auto' | '5' | '100'>('auto');
  const [result, setResult] = useState<{ dataset: Dataset; report: ImportReport } | null>(null);
  const [saved, setSaved] = useState(false);

  const reset = () => {
    setFile(null);
    setParsed(null);
    setError(undefined);
    setResult(null);
    setSaved(false);
    setMapping({});
    if (inputRef.current) inputRef.current.value = '';
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    reset();
    setBusy(true);
    try {
      const p = await parseImportFile(f);
      setFile(f);
      setParsed(p);
      setMapping(autoDetectMapping(p.columns));
      setName(f.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      setError(e instanceof ImportError ? t(`importErr.${e.code}`, e.params) : t('importErr.read', { detail: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  const productParsed = product.trim() ? parseProductInput(product) : null;
  const productError = productParsed && 'error' in productParsed ? productInputErrorText(productParsed, t) : undefined;
  const missing = missingRequired(mapping);

  const validate = () => {
    if (!parsed || missing.length || productError) return;
    setBusy(true);
    // Let the spinner paint before the (synchronous) normalisation of large files.
    setTimeout(() => {
      const datasetId = randomId('ds');
      const productId = productParsed && 'productId' in productParsed ? productParsed.productId : undefined;
      const { reviews, report } = normalizeRows(parsed.rows, mapping, { datasetId, origin: 'import', dateOrder, ratingScale, productId });
      const notes = [t('note.importedFrom', { file: file?.name ?? '', format: parsed.format.toUpperCase(), rows: parsed.rows.length })];
      if (parsed.truncated) notes.push(t('note.truncated', { max: MAX_IMPORT_ROWS }));
      if (report.skipped) notes.push(t('note.skippedValidation', { count: report.skipped }));
      notes.push(t('note.fileCompleteness'));
      setResult({
        report,
        dataset: {
          id: datasetId,
          name: name.trim() || file?.name || t('import.defaultName'),
          origin: 'import',
          sourceLabel: file?.name ?? 'file',
          productId,
          productUrl: productParsed && 'canonicalUrl' in productParsed ? productParsed.canonicalUrl : undefined,
          createdAt: new Date().toISOString(),
          reviews,
          completeness: 'unknown',
          notes,
        },
      });
      setBusy(false);
    }, 20);
  };

  const save = async () => {
    if (!result || !result.dataset.reviews.length) return;
    await saveDataset(result.dataset);
    setActiveDataset(result.dataset.id);
    setPendingProductId(undefined);
    setSaved(true);
    notify('success', t('import.done', { count: result.dataset.reviews.length }));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void onFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="space-y-5">
      {!parsed && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? 'border-brand bg-brand-soft/40' : 'border-line-strong bg-surface-2'}`}
        >
          <Upload className="mb-3 size-7 text-ink-3" aria-hidden />
          <p className="text-sm font-medium text-ink">{t('import.drop')}</p>
          <p className="mt-1 text-xs text-ink-3">{t('import.limits', { mb: MAX_IMPORT_BYTES / 1024 / 1024, rows: MAX_IMPORT_ROWS })}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" loading={busy} icon={<FileUp className="size-4" />} onClick={() => inputRef.current?.click()}>
              {t('import.choose')}
            </Button>
            <Button variant="ghost" icon={<Download className="size-4" />} onClick={() => downloadBlob(new Blob([`\uFEFF${TEMPLATE}\r\n`], { type: 'text/csv' }), 'review-import-template.csv')}>
              {t('import.template')}
            </Button>
          </div>
          <input ref={inputRef} type="file" accept=".csv,.json,.tsv,.txt,text/csv,application/json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label={t('import.fileAria')} />
        </div>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-neg-soft px-3 py-2.5 text-sm text-neg">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}

      {parsed && !result && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-2">
              <strong className="text-ink">{file?.name}</strong> · {parsed.format.toUpperCase()} · {t('import.rowsCols', { rows: parsed.rows.length, cols: parsed.columns.length })}
              {parsed.truncated && <span className="text-warn-ink"> · {t('import.truncatedTo', { max: MAX_IMPORT_ROWS })}</span>}
            </p>
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={reset}>
              {t('import.another')}
            </Button>
          </div>
          {parsed.parseWarnings.length > 0 && (
            <details className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn-ink">
              <summary className="cursor-pointer font-medium">{t('import.parserMessages', { count: parsed.parseWarnings.length })}</summary>
              <ul className="mt-1 list-disc pl-5">{parsed.parseWarnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </details>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t('import.datasetName')}>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </Field>
            <Field label={t('import.product')} hint={productError ?? t('import.productHint')}>
              <input className={`${inputClass} ${productError ? 'border-neg' : ''}`} value={product} onChange={(e) => setProduct(e.target.value)} placeholder="https://www.aliexpress.com/item/….html" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('import.ambiguousDates')} hint={t('import.ambiguousHint')}>
                <select className={inputClass} value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
                  <option value="MDY">{t('import.mdy')}</option>
                  <option value="DMY">{t('import.dmy')}</option>
                </select>
              </Field>
              <Field label={t('import.ratingScale')}>
                <select className={inputClass} value={ratingScale} onChange={(e) => setRatingScale(e.target.value as typeof ratingScale)}>
                  <option value="auto">{t('import.auto')}</option>
                  <option value="5">1–5</option>
                  <option value="100">20–100 %</option>
                </select>
              </Field>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">{t('import.mapColumns')}</h3>
            <p className="mb-3 text-xs text-ink-3">{t('import.mapHint')}</p>
            <div className="grid gap-x-4 gap-y-2.5 md:grid-cols-2 xl:grid-cols-3">
              {CANONICAL_FIELDS.map((field: CanonicalField) => (
                <label key={field} className="flex items-center gap-2 text-[13px]">
                  <span className="w-44 shrink-0 text-ink-2">
                    {t(`field.${field}`)}
                    {REQUIRED_FIELDS.includes(field) && <span className="text-neg"> *</span>}
                  </span>
                  <select
                    className={`${inputClass} h-8 text-[13px] ${missing.includes(field) ? 'border-neg' : ''}`}
                    value={mapping[field] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))}
                  >
                    <option value="">{t('import.notInFile')}</option>
                    {parsed.columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {missing.length > 0 && <p className="mt-2 text-xs text-neg">{t('import.required', { list: missing.map((f) => t(`field.${f}`)).join(', ') })}</p>}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">{t('import.preview')}</h3>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead className="bg-surface-2 text-ink-3">
                  <tr>
                    {parsed.columns.slice(0, 10).map((c) => (
                      <th key={c} className="whitespace-nowrap px-2.5 py-2 text-left font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {parsed.rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {parsed.columns.slice(0, 10).map((c) => (
                        <td key={c} className="max-w-60 truncate px-2.5 py-1.5 text-ink-2">
                          {previewCell(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.columns.length > 10 && <p className="mt-1 text-xs text-ink-3">{t('import.moreColumns', { count: parsed.columns.length - 10 })}</p>}
          </div>

          <div className="flex justify-end">
            <Button variant="primary" loading={busy} disabled={missing.length > 0 || Boolean(productError)} onClick={validate}>
              {t('import.validate', { count: parsed.rows.length })}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs text-ink-2">{t('import.rowsInFile')}</p>
              <p className="tabular mt-1 text-2xl font-semibold">{result.report.totalRows.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs text-ink-2">{t('import.valid')}</p>
              <p className="tabular mt-1 text-2xl font-semibold text-ok">{result.report.imported.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs text-ink-2">{t('import.skipped')}</p>
              <p className={`tabular mt-1 text-2xl font-semibold ${result.report.skipped ? 'text-neg' : ''}`}>{result.report.skipped.toLocaleString()}</p>
            </div>
          </div>
          {(Object.keys(result.report.skipReasons).length > 0 || Object.keys(result.report.warnings).length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {Object.keys(result.report.skipReasons).length > 0 && (
                <div className="rounded-lg border border-line p-3">
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3">{t('import.whySkipped')}</h4>
                  <ul className="space-y-1 text-sm">
                    {(Object.entries(result.report.skipReasons) as Array<[SkipReason, number]>).map(([k, n]) => (
                      <li key={k} className="flex justify-between gap-3">
                        <span className="text-ink-2">{t(`skip.${k}`)}</span>
                        <span className="tabular font-medium">{n.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Object.keys(result.report.warnings).length > 0 && (
                <div className="rounded-lg border border-line p-3">
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3">{t('import.fixed')}</h4>
                  <ul className="space-y-1 text-sm">
                    {(Object.entries(result.report.warnings) as Array<[WarningKind, number]>).map(([k, n]) => (
                      <li key={k} className="flex justify-between gap-3">
                        <span className="text-ink-2">{t(`warn.${k}`)}</span>
                        <span className="tabular font-medium">{n.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {result.report.examples.length > 0 && (
            <details className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
              <summary className="cursor-pointer font-medium">{t('import.rowDetails', { count: result.report.examples.length })}</summary>
              <ul className="mt-1.5 space-y-0.5">
                {result.report.examples.map((e, i) => (
                  <li key={i}>
                    <span className="tabular text-ink-3">{t('import.row', { row: e.row })}</span>{' '}
                    {e.kind === 'invalid-date' ? t('import.exampleDate', { value: e.detail ?? '' }) : `${t(`skip.${e.kind}`)}${e.detail ? `: ${e.detail}` : ''}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex justify-end gap-2">
            {saved ? (
              <>
                <Button onClick={reset}>{t('import.importAnother')}</Button>
                <Button variant="primary" icon={<CheckCircle2 className="size-4" />} onClick={() => navigate('overview')}>
                  {t('import.openDashboard')}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setResult(null)}>{t('import.back')}</Button>
                <Button variant="primary" disabled={!result.dataset.reviews.length} onClick={save}>
                  {result.dataset.reviews.length ? t('import.save', { count: result.dataset.reviews.length }) : t('import.nothing')}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
