import type { DataOrigin, Review } from '../../types/review';
import { tagLabel } from '../../features/insights/insights';

/**
 * Export columns use the importer's canonical names, so an export can be re-imported.
 * Reviewer names/avatars are never stored, so they can never be exported.
 */
export const EXPORT_COLUMNS = [
  'review_id',
  'product_id',
  'rating',
  'review_text',
  'review_date',
  'reviewer_country',
  'product_variant',
  'review_images',
  'review_video',
  'source_url',
  'language',
  'sentiment',
  'sentiment_confidence',
  'sentiment_method',
  'tags',
  'aspects',
  'helpful_count',
  'data_origin',
] as const;

export type ExportColumn = (typeof EXPORT_COLUMNS)[number];
export type ExportRow = Record<ExportColumn, string | number>;

const ORIGIN_VALUE: Record<DataOrigin, string> = {
  import: 'imported-file',
  api: 'data-provider',
  demo: 'DEMO-synthetic-not-real',
};

export function toExportRow(r: Review, origin?: DataOrigin): ExportRow {
  const s = r.aiSentiment ?? r.sentiment;
  return {
    review_id: r.id,
    product_id: r.productId ?? '',
    rating: r.rating,
    review_text: r.text,
    review_date: r.date ?? '',
    reviewer_country: r.country ?? '',
    product_variant: r.variant ?? '',
    review_images: r.images.join(' | '),
    review_video: r.videos.join(' | '),
    source_url: r.sourceUrl ?? '',
    language: r.language,
    sentiment: s.label,
    sentiment_confidence: s.confidence,
    sentiment_method: s.method,
    tags: r.tags.map(tagLabel).join('; '),
    aspects: r.aspects.join('; '),
    helpful_count: r.helpfulCount ?? '',
    data_origin: origin ? ORIGIN_VALUE[origin] : '',
  };
}

/**
 * Neutralises spreadsheet formula injection (CWE-1236): cells starting with = + - @
 * or a control character are prefixed with an apostrophe so Excel/Sheets treat them as text.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number): string {
  const s = typeof value === 'number' ? String(value) : neutralizeFormula(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(reviews: Review[], origin?: DataOrigin): string {
  const lines = [EXPORT_COLUMNS.join(',')];
  for (const r of reviews) {
    const row = toExportRow(r, origin);
    lines.push(EXPORT_COLUMNS.map((c) => csvCell(row[c])).join(','));
  }
  // BOM so Excel opens UTF-8 (Vietnamese, Cyrillic...) correctly.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function toJson(reviews: Review[], meta: Record<string, unknown>, origin?: DataOrigin): string {
  return JSON.stringify(
    {
      ...meta,
      exportedAt: new Date().toISOString(),
      count: reviews.length,
      reviews: reviews.map((r) => ({
        ...toExportRow(r, origin),
        review_images: r.images,
        review_video: r.videos,
        tags: r.tags,
        aspects: r.aspects,
        sentiment_reason: (r.aiSentiment ?? r.sentiment).reason,
      })),
    },
    null,
    2,
  );
}
