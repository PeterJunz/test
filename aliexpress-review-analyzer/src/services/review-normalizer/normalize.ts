import type { DataOrigin, Review, StarRating } from '../../types/review';
import { normalizeCountry } from '../../utils/country';
import { parseReviewDate, type DateOrder } from '../../utils/date';
import { stableId } from '../../utils/hash';
import { detectLanguage, normalizeLanguageCode } from '../../utils/language';
import { toSafeHttpUrl } from '../../utils/url';
import { classifySentiment, detectAspects, detectTags } from '../sentiment-analysis/analyzer';
import type { FieldMapping } from './fields';

export type RawRow = Record<string, unknown>;

export type SkipReason = 'empty-row' | 'missing-rating' | 'invalid-rating' | 'duplicate';
export type WarningKind =
  | 'invalid-date'
  | 'invalid-image-url'
  | 'invalid-video-url'
  | 'invalid-source-url'
  | 'text-truncated';

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  'empty-row': 'Row is empty',
  'missing-rating': 'Rating is missing',
  'invalid-rating': 'Rating is not a whole number from 1 to 5',
  duplicate: 'Duplicate of an earlier row',
};

export const WARNING_LABELS: Record<WarningKind, string> = {
  'invalid-date': 'Invalid date (row kept, date left empty)',
  'invalid-image-url': 'Invalid image URL removed',
  'invalid-video-url': 'Invalid video URL removed',
  'invalid-source-url': 'Invalid source URL removed',
  'text-truncated': 'Review text longer than 5,000 characters truncated',
};

export interface NormalizeOptions {
  datasetId: string;
  origin: DataOrigin;
  dateOrder?: DateOrder;
  /** `auto` also accepts AliExpress' 20/40/60/80/100 percentage scale. */
  ratingScale?: 'auto' | '5' | '100';
  productId?: string;
}

export interface ImportReport {
  totalRows: number;
  imported: number;
  skipped: number;
  skipReasons: Partial<Record<SkipReason, number>>;
  warnings: Partial<Record<WarningKind, number>>;
  /** First few problems with 1-based row numbers, for display. `message` is the English text. */
  examples: Array<{ row: number; kind: SkipReason | 'invalid-date'; detail?: string; message: string }>;
}

export const MAX_TEXT_LENGTH = 5000;
const MAX_MEDIA_PER_REVIEW = 20;
const MAX_EXAMPLES = 25;

export function parseRating(raw: unknown, scale: NormalizeOptions['ratingScale'] = 'auto'): StarRating | 'missing' | 'invalid' {
  if (raw === null || raw === undefined) return 'missing';
  let value: number;
  if (typeof raw === 'number') {
    value = raw;
  } else {
    const s = String(raw).trim();
    if (!s) return 'missing';
    const stars = s.match(/★/g);
    if (stars && /^[★☆\s]+$/.test(s)) {
      value = stars.length;
    } else {
      const m = s.replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(?:%|stars?|\/\s*5|sao|estrellas?|estrelas?|étoiles?|sterne?)?$/i);
      if (!m) return 'invalid';
      value = Number(m[1]);
    }
  }
  if (!Number.isFinite(value)) return 'invalid';
  if (scale === '100' || (scale === 'auto' && value > 5 && value <= 100 && value % 20 === 0)) value = value / 20;
  if (!Number.isInteger(value) || value < 1 || value > 5) return 'invalid';
  return value as StarRating;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };

/** Converts source text to plain text. The UI always renders it as text, never as HTML. */
export function cleanText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const s = typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '';
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]{0,200}>/g, '')
    .replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Extracts URL candidates from a string list, an array, or an array of objects ({url}, {src}...). */
export function extractUrlCandidates(raw: unknown): string[] {
  if (raw === null || raw === undefined || raw === '') return [];
  if (Array.isArray(raw)) return raw.flatMap(extractUrlCandidates);
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['url', 'src', 'href', 'imageUrl', 'image_url', 'videoUrl', 'video_url', 'link']) {
      if (typeof obj[key] === 'string') return [obj[key] as string];
    }
    return [];
  }
  const s = String(raw).trim();
  if (s.startsWith('[')) {
    try {
      return extractUrlCandidates(JSON.parse(s));
    } catch {
      /* fall through to splitting */
    }
  }
  return s.split(/[\s,;|]+/).filter(Boolean);
}

function cleanUrls(raw: unknown): { urls: string[]; invalid: number } {
  const candidates = extractUrlCandidates(raw);
  const urls: string[] = [];
  let invalid = 0;
  for (const c of candidates) {
    const safe = toSafeHttpUrl(c);
    if (safe) {
      if (!urls.includes(safe) && urls.length < MAX_MEDIA_PER_REVIEW) urls.push(safe);
    } else {
      invalid++;
    }
  }
  return { urls, invalid };
}

function isEmptyRow(row: RawRow): boolean {
  return Object.values(row).every((v) => v === null || v === undefined || String(v).trim() === '');
}

/** Builds a fully analysed review from already-validated parts. Shared by importers and API providers. */
export function buildReview(parts: Omit<Review, 'id' | 'sentiment' | 'aspects' | 'tags' | 'language' | 'languageDetected'> & {
  id?: string;
  language?: string;
}): Review {
  const detected = parts.language ? undefined : detectLanguage(parts.text);
  const language = parts.language ?? detected ?? 'und';
  return {
    ...parts,
    id: parts.id ?? stableId([parts.rating, parts.text, parts.date, parts.country, parts.variant, parts.images[0]]),
    language,
    languageDetected: !parts.language,
    sentiment: classifySentiment(parts.rating, parts.text, language),
    aspects: detectAspects(parts.text),
    tags: detectTags(parts.text),
  };
}

/** Validates, cleans, de-duplicates and analyses raw rows according to a field mapping. */
export function normalizeRows(rows: RawRow[], mapping: FieldMapping, options: NormalizeOptions): { reviews: Review[]; report: ImportReport } {
  const report: ImportReport = { totalRows: rows.length, imported: 0, skipped: 0, skipReasons: {}, warnings: {}, examples: [] };
  const seen = new Set<string>();
  const reviews: Review[] = [];

  const skip = (rowIndex: number, reason: SkipReason, detail?: string) => {
    report.skipped++;
    report.skipReasons[reason] = (report.skipReasons[reason] ?? 0) + 1;
    if (report.examples.length < MAX_EXAMPLES) {
      report.examples.push({ row: rowIndex + 1, kind: reason, detail, message: detail ? `${SKIP_REASON_LABELS[reason]}: ${detail}` : SKIP_REASON_LABELS[reason] });
    }
  };
  const warn = (kind: WarningKind, count = 1) => {
    report.warnings[kind] = (report.warnings[kind] ?? 0) + count;
  };
  const get = (row: RawRow, field: keyof FieldMapping) => {
    const column = mapping[field];
    return column ? row[column] : undefined;
  };

  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || isEmptyRow(row)) return skip(index, 'empty-row');

    const rawRating = get(row, 'rating');
    const rating = parseRating(rawRating, options.ratingScale);
    if (rating === 'missing') return skip(index, 'missing-rating');
    if (rating === 'invalid') return skip(index, 'invalid-rating', JSON.stringify(String(rawRating)).slice(0, 40));

    let text = cleanText(get(row, 'review_text'));
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.slice(0, MAX_TEXT_LENGTH);
      warn('text-truncated');
    }

    const rawDate = get(row, 'review_date');
    const date = parseReviewDate(rawDate, options.dateOrder);
    if (!date && rawDate !== undefined && rawDate !== null && String(rawDate).trim() !== '') {
      warn('invalid-date');
      if (report.examples.length < MAX_EXAMPLES) {
        const detail = String(rawDate).slice(0, 30);
        report.examples.push({ row: index + 1, kind: 'invalid-date', detail, message: `Invalid date "${detail}" — kept without a date` });
      }
    }

    const images = cleanUrls(get(row, 'review_images'));
    if (images.invalid) warn('invalid-image-url', images.invalid);
    const videos = cleanUrls(get(row, 'review_video'));
    if (videos.invalid) warn('invalid-video-url', videos.invalid);

    const rawSource = get(row, 'source_url');
    const sourceUrl = toSafeHttpUrl(rawSource);
    if (!sourceUrl && typeof rawSource === 'string' && rawSource.trim()) warn('invalid-source-url');

    const helpfulRaw = Number(get(row, 'helpful_count'));
    const originalId = get(row, 'review_id');
    const productIdRaw = get(row, 'product_id');
    const variantRaw = cleanText(get(row, 'product_variant'));

    const parts = {
      datasetId: options.datasetId,
      productId: productIdRaw !== undefined && String(productIdRaw).trim() ? String(productIdRaw).trim().slice(0, 40) : options.productId,
      rating,
      text,
      date,
      country: normalizeCountry(get(row, 'reviewer_country')),
      variant: variantRaw ? variantRaw.slice(0, 200) : undefined,
      images: images.urls,
      videos: videos.urls,
      sourceUrl,
      language: normalizeLanguageCode(get(row, 'language')),
      helpfulCount: Number.isFinite(helpfulRaw) && helpfulRaw >= 0 ? Math.floor(helpfulRaw) : undefined,
    };

    // Rows that carry neither an original id, text nor media cannot be told apart from
    // genuinely different star-only reviews, so they are never treated as duplicates.
    const hasIdentity = (originalId !== undefined && String(originalId).trim() !== '') || text !== '' || images.urls.length > 0;
    const key = originalId !== undefined && String(originalId).trim() !== ''
      ? `id:${String(originalId).trim()}`
      : stableId([rating, text, date, parts.country, parts.variant, images.urls.join(' ')]);
    if (hasIdentity) {
      if (seen.has(key)) return skip(index, 'duplicate');
      seen.add(key);
    }

    reviews.push(
      buildReview({
        ...parts,
        id: hasIdentity ? stableId([options.datasetId, key]) : stableId([options.datasetId, key, index]),
      }),
    );
    report.imported++;
  });

  return { reviews, report };
}
