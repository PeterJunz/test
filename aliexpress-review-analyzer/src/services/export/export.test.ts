import { describe, expect, it } from 'vitest';
import { buildReview } from '../review-normalizer/normalize';
import { neutralizeFormula, toCsv, toJson } from './rows';
import { pdfSafe } from './pdf';
import { parseCsvText } from '../review-normalizer/parse';
import { autoDetectMapping } from '../review-normalizer/fields';
import { normalizeRows } from '../review-normalizer/normalize';

const reviews = [
  buildReview({ datasetId: 'd', rating: 5, text: 'Great, "quoted", with comma\nand newline', images: ['https://x.com/a.jpg', 'https://x.com/b.jpg'], videos: [], country: 'US', date: '2026-01-02' }),
  buildReview({ datasetId: 'd', rating: 1, text: '=HYPERLINK("http://evil")', images: [], videos: [] }),
];

describe('CSV export', () => {
  it('escapes and neutralises formulas', () => {
    const csv = toCsv(reviews);
    expect(csv.startsWith('﻿review_id,')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  it('round-trips through the importer', () => {
    const parsed = parseCsvText(toCsv(reviews));
    const { reviews: back, report } = normalizeRows(parsed.rows, autoDetectMapping(parsed.columns), { datasetId: 'x', origin: 'import' });
    expect(report.imported).toBe(2);
    expect(back[0].text).toBe(reviews[0].text);
    expect(back[0].images).toEqual(reviews[0].images);
    expect(back[0].country).toBe('US');
  });
});

describe('neutralizeFormula', () => {
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx'])('prefixes %j', (v) => expect(neutralizeFormula(v).startsWith("'")).toBe(true));
  it('leaves normal text', () => expect(neutralizeFormula('Good')).toBe('Good'));
});

describe('JSON export', () => {
  it('contains arrays for media and the selection metadata', () => {
    const doc = JSON.parse(toJson(reviews, { filters: 'all' }));
    expect(doc.count).toBe(2);
    expect(doc.reviews[0].review_images).toHaveLength(2);
    expect(doc.filters).toBe('all');
  });
});

describe('pdfSafe', () => {
  it('transliterates diacritics and drops unsupported scripts', () => {
    expect(pdfSafe('Sản phẩm đẹp — “ok”')).toBe('San pham dep - "ok"');
    expect(pdfSafe('Отлично')).toBe('');
  });
});
