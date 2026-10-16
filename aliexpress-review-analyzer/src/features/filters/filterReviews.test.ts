import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, type ReviewFilters } from '../../types/filters';
import type { Review, StarRating } from '../../types/review';
import { buildReview } from '../../services/review-normalizer/normalize';
import { countActiveFilters, facetCounts, filterReviews, parseSearch, sortReviews } from './filterReviews';

const NOW = new Date('2026-10-16T12:00:00Z');

function review(id: string, rating: StarRating, text: string, extra: Partial<Review> = {}): Review {
  return { ...buildReview({ datasetId: 'd', rating, text, images: [], videos: [], ...extra }), id };
}

const data: Review[] = [
  review('a', 1, 'Arrived broken, poor quality', { country: 'US', date: '2026-09-20', images: ['https://x.com/1.jpg'] }),
  review('b', 1, 'Stopped working', { country: 'US', date: '2026-03-01', images: ['https://x.com/2.jpg'] }),
  review('c', 1, 'No funciona', { country: 'ES', date: '2026-10-01', images: ['https://x.com/3.jpg'] }),
  review('d', 5, 'Excellent quality, fast shipping', { country: 'US', date: '2026-10-10', videos: ['https://x.com/v.mp4'] }),
  review('e', 4, '', { country: 'BR', date: '2026-08-01' }),
  review('f', 3, 'It is ok. Qualité moyenne', { country: 'FR' }),
];

const f = (patch: Partial<ReviewFilters>): ReviewFilters => ({ ...EMPTY_FILTERS, ...patch });
const ids = (list: Review[]) => list.map((r) => r.id).sort();

describe('filterReviews', () => {
  it('returns everything with empty filters', () => {
    expect(filterReviews(data, EMPTY_FILTERS, NOW)).toHaveLength(data.length);
  });

  it('filters by multiple star ratings', () => {
    expect(ids(filterReviews(data, f({ ratings: [4, 5] }), NOW))).toEqual(['d', 'e']);
  });

  it('combines filters: 1-star + photos + US + last 90 days', () => {
    const result = filterReviews(data, f({ ratings: [1], hasPhotos: 'yes', countries: ['US'], datePreset: '90' }), NOW);
    expect(ids(result)).toEqual(['a']);
  });

  it('filters by media and text presence', () => {
    expect(ids(filterReviews(data, f({ hasVideo: 'yes' }), NOW))).toEqual(['d']);
    expect(ids(filterReviews(data, f({ hasText: 'no' }), NOW))).toEqual(['e']);
    expect(ids(filterReviews(data, f({ hasPhotos: 'no', hasText: 'yes' }), NOW))).toEqual(['d', 'f']);
  });

  it('filters by sentiment', () => {
    expect(ids(filterReviews(data, f({ sentiments: ['negative'] }), NOW))).toEqual(['a', 'b', 'c']);
    expect(ids(filterReviews(data, f({ sentiments: ['positive'] }), NOW))).toEqual(['d', 'e']);
  });

  it('prefers AI sentiment when present', () => {
    const withAi = [{ ...data[5], aiSentiment: { label: 'negative' as const, confidence: 0.8, method: 'ai' as const, reason: '' } }];
    expect(filterReviews(withAi, f({ sentiments: ['negative'] }), NOW)).toHaveLength(1);
  });

  it('excludes undated reviews once a date filter is active, and supports custom ranges', () => {
    expect(filterReviews(data, f({ datePreset: '365' }), NOW).map((r) => r.id)).not.toContain('f');
    expect(ids(filterReviews(data, f({ datePreset: 'custom', dateFrom: '2026-08-01', dateTo: '2026-09-30' }), NOW))).toEqual(['a', 'e']);
  });

  it('filters by aspect and tag', () => {
    expect(ids(filterReviews(data, f({ tags: ['not-working'] }), NOW))).toEqual(['b', 'c']);
    expect(ids(filterReviews(data, f({ aspects: ['shipping'] }), NOW))).toContain('d');
  });

  it('searches with AND terms, phrases, exclusions and accent folding', () => {
    expect(ids(filterReviews(data, f({ search: 'quality' }), NOW))).toEqual(['a', 'd']);
    expect(ids(filterReviews(data, f({ search: 'quality -poor' }), NOW))).toEqual(['d']);
    expect(ids(filterReviews(data, f({ search: '"fast shipping"' }), NOW))).toEqual(['d']);
    expect(ids(filterReviews(data, f({ search: 'qualite' }), NOW))).toEqual(['f']);
  });
});

describe('parseSearch', () => {
  it('splits terms', () => {
    expect(parseSearch('a "b c" -d')).toEqual({ include: ['a', 'b c'], exclude: ['d'] });
  });
});

describe('sortReviews', () => {
  it('sorts by rating and date, keeping missing values last', () => {
    expect(sortReviews(data, { field: 'rating', direction: 'desc' })[0].id).toBe('d');
    const byDate = sortReviews(data, { field: 'date', direction: 'asc' });
    expect(byDate[0].id).toBe('b');
    expect(byDate[byDate.length - 1].id).toBe('f');
    expect(sortReviews(data, { field: 'date', direction: 'desc' }).at(-1)?.id).toBe('f');
  });
});

describe('facetCounts / countActiveFilters', () => {
  it('counts facets', () => {
    const c = facetCounts(data);
    expect(c.ratings[1]).toBe(3);
    expect(c.photos).toBe(3);
    expect(c.videos).toBe(1);
    expect(c.countries.get('US')).toBe(3);
  });
  it('counts active filters', () => {
    expect(countActiveFilters(f({ ratings: [1], search: 'x', hasPhotos: 'yes' }))).toBe(3);
  });
});
