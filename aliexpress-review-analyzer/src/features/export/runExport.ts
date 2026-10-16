import type { Dataset, Review } from '../../types/review';
import { downloadBlob, safeFileName } from '../../services/export/download';
import { toCsv, toJson } from '../../services/export/rows';
import { computeStats } from '../dashboard/stats';

export type ExportFormat = 'csv' | 'json' | 'xlsx';

export async function exportReviews(format: ExportFormat, reviews: Review[], dataset: Dataset, selectionLabel: string): Promise<void> {
  const base = safeFileName(`reviews-${dataset.productId ?? dataset.name}-${selectionLabel}-${new Date().toISOString().slice(0, 10)}`);
  const meta = {
    dataset: dataset.name,
    origin: dataset.origin,
    demoData: dataset.origin === 'demo',
    productId: dataset.productId ?? null,
    completeness: dataset.completeness,
    selection: selectionLabel,
  };
  if (format === 'csv') {
    downloadBlob(new Blob([toCsv(reviews, dataset.origin)], { type: 'text/csv;charset=utf-8' }), `${base}.csv`);
  } else if (format === 'json') {
    downloadBlob(new Blob([toJson(reviews, meta, dataset.origin)], { type: 'application/json' }), `${base}.json`);
  } else {
    const { toXlsx } = await import('../../services/export/xlsx');
    const s = computeStats(reviews);
    const blob = await toXlsx(reviews, [
      ['Dataset', dataset.name],
      ['Origin', dataset.origin === 'demo' ? 'DEMO — synthetic data, not from AliExpress' : dataset.origin],
      ['Product ID', dataset.productId ?? ''],
      ['Selection', selectionLabel],
      ['Data completeness', dataset.completeness],
      ['Reviews exported', s.total],
      ['Average rating', s.averageRating === null ? '' : Number(s.averageRating.toFixed(2))],
      ['Positive', s.positive],
      ['Neutral', s.neutral],
      ['Negative', s.negative],
      ['Uncertain', s.uncertain],
      ['With photos', s.photos],
      ['With video', s.videos],
      ['Exported at', new Date().toISOString()],
    ], dataset.origin);
    downloadBlob(blob, `${base}.xlsx`);
  }
}
