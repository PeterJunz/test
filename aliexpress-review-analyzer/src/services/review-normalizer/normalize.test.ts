import { describe, expect, it } from 'vitest';
import { autoDetectMapping, missingRequired } from './fields';
import { cleanText, extractUrlCandidates, normalizeRows, parseRating } from './normalize';
import { flattenRecord, parseCsvText, parseJsonText, ImportError, findRecordArray } from './parse';

const opts = { datasetId: 'ds_test', origin: 'import' as const };

describe('parseRating', () => {
  it.each([
    [5, 5], ['4', 4], ['3.0', 3], ['2 stars', 2], ['★★★★☆', 4], ['100', 5], [80, 4], ['20', 1], ['5/5', 5], ['4 sao', 4],
  ])('parses %j as %j', (input, expected) => {
    expect(parseRating(input)).toBe(expected);
  });

  it.each([[0], [6], ['4.5'], ['abc'], [-1], ['55'], [NaN]])('rejects %j', (input) => {
    expect(parseRating(input)).toBe('invalid');
  });

  it('reports missing values', () => {
    expect(parseRating(undefined)).toBe('missing');
    expect(parseRating('  ')).toBe('missing');
  });

  it('respects an explicit 5-point scale (no percentage conversion)', () => {
    expect(parseRating('20', '5')).toBe('invalid');
  });
});

describe('cleanText', () => {
  it('strips tags, decodes entities and control characters', () => {
    expect(cleanText('Great<br>product &amp; <b>fast</b>\u0007 ship')).toBe('Great\nproduct & fast ship');
  });
  it('keeps script tags inert by removing them (UI renders text only anyway)', () => {
    expect(cleanText('<script>alert(1)</script>ok')).toBe('alert(1)ok');
  });
});

describe('extractUrlCandidates', () => {
  it('handles delimited strings, JSON arrays and object arrays', () => {
    expect(extractUrlCandidates('https://a.com/1.jpg, https://a.com/2.jpg|https://a.com/3.jpg')).toHaveLength(3);
    expect(extractUrlCandidates('["https://a.com/1.jpg"]')).toEqual(['https://a.com/1.jpg']);
    expect(extractUrlCandidates([{ url: 'https://a.com/x.jpg' }, { src: '//b.com/y.png' }])).toEqual(['https://a.com/x.jpg', '//b.com/y.png']);
  });
});

describe('autoDetectMapping', () => {
  it('maps canonical names and common synonyms', () => {
    const m = autoDetectMapping(['Stars', 'Comment', 'Date', 'Country', 'SKU', 'Photos', 'url']);
    expect(m).toMatchObject({ rating: 'Stars', review_text: 'Comment', review_date: 'Date', reviewer_country: 'Country', product_variant: 'SKU', review_images: 'Photos', source_url: 'url' });
  });
  it('flags the missing required rating column', () => {
    expect(missingRequired(autoDetectMapping(['text', 'date']))).toEqual(['rating']);
  });
});

describe('normalizeRows', () => {
  const mapping = autoDetectMapping(['rating', 'review_text', 'review_date', 'reviewer_country', 'review_images', 'source_url']);

  it('imports valid rows and reports skipped rows with reasons', () => {
    const rows = [
      { rating: '5', review_text: 'Great quality, works perfectly', review_date: '2026-01-05', reviewer_country: 'United States', review_images: 'https://ae01.alicdn.com/a.jpg', source_url: 'https://www.aliexpress.com/item/1.html' },
      { rating: '7', review_text: 'bad scale' },
      { rating: '', review_text: 'no stars' },
      { rating: '5', review_text: 'Great quality, works perfectly', review_date: '2026-01-05', reviewer_country: 'United States', review_images: 'https://ae01.alicdn.com/a.jpg' },
      { rating: '', review_text: '' },
      { rating: '1', review_text: 'Arrived broken', review_date: '31/31/2026', review_images: 'javascript:alert(1) https://ok.com/b.jpg', source_url: 'javascript:alert(1)' },
    ];
    const { reviews, report } = normalizeRows(rows, mapping, opts);
    expect(report.totalRows).toBe(6);
    expect(report.imported).toBe(2);
    expect(report.skipped).toBe(4);
    expect(report.skipReasons).toEqual({ 'invalid-rating': 1, 'missing-rating': 1, duplicate: 1, 'empty-row': 1 });
    expect(report.warnings).toMatchObject({ 'invalid-date': 1, 'invalid-image-url': 1, 'invalid-source-url': 1 });
    const [first, second] = reviews;
    expect(first.country).toBe('US');
    expect(first.date).toBe('2026-01-05');
    expect(first.sentiment.label).toBe('positive');
    expect(second.date).toBeUndefined();
    expect(second.images).toEqual(['https://ok.com/b.jpg']);
    expect(second.sourceUrl).toBeUndefined();
    expect(second.tags).toContain('damaged-in-shipping');
  });

  it('never de-duplicates star-only rows (they may be different buyers)', () => {
    const rows = [{ rating: 5 }, { rating: 5 }, { rating: 5 }];
    const { reviews, report } = normalizeRows(rows, { rating: 'rating' }, opts);
    expect(report.imported).toBe(3);
    expect(new Set(reviews.map((r) => r.id)).size).toBe(3);
  });

  it('de-duplicates by original review id when present', () => {
    const rows = [{ id: 'A1', rating: 5, text: 'x' }, { id: 'A1', rating: 4, text: 'y' }];
    const { report } = normalizeRows(rows, { rating: 'rating', review_text: 'text', review_id: 'id' }, opts);
    expect(report.skipReasons.duplicate).toBe(1);
  });

  it('truncates very long text with a warning', () => {
    const { reviews, report } = normalizeRows([{ rating: 3, t: 'a'.repeat(6000) }], { rating: 'rating', review_text: 't' }, opts);
    expect(reviews[0].text).toHaveLength(5000);
    expect(report.warnings['text-truncated']).toBe(1);
  });
});

describe('file parsing', () => {
  it('parses CSV with quoted multi-line fields and a BOM', () => {
    const csv = '\uFEFFrating,review_text\n5,"Line one\nline two, with comma"\n1,"He said ""broken"""\n';
    const parsed = parseCsvText(csv);
    expect(parsed.columns).toEqual(['rating', 'review_text']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].review_text).toBe('Line one\nline two, with comma');
    expect(parsed.rows[1].review_text).toBe('He said "broken"');
  });

  it('finds the review array inside nested JSON and flattens objects', () => {
    const json = JSON.stringify({ data: { total: 2, reviews: [{ star: 5, buyer: { country: 'US' }, images: ['https://x.com/1.jpg'] }, { star: 1 }] } });
    const parsed = parseJsonText(json);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]['buyer.country']).toBe('US');
    expect(parsed.rows[0].images).toEqual(['https://x.com/1.jpg']);
  });

  it('rejects malformed JSON and JSON without records', () => {
    expect(() => parseJsonText('{oops')).toThrow(ImportError);
    expect(() => parseJsonText('{"a":1}')).toThrow(/No array/);
  });

  it('ignores prototype-polluting keys', () => {
    const flat = flattenRecord(JSON.parse('{"__proto__":{"x":1},"a":{"constructor":2,"b":3}}'));
    expect(flat).toEqual({ 'a.b': 3 });
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('returns an empty list for an empty JSON array', () => {
    expect(findRecordArray([])).toEqual([]);
  });
});
