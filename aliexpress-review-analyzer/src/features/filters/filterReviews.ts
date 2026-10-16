import type { ReviewFilters, SortState, TriState } from '../../types/filters';
import type { Review, SentimentLabel } from '../../types/review';
import { daysAgo } from '../../utils/date';

/** The sentiment used for filtering: AI result when available, otherwise the rule-based one. */
export function effectiveSentiment(review: Review): SentimentLabel {
  return (review.aiSentiment ?? review.sentiment).label;
}

function tri(state: TriState, value: boolean): boolean {
  return state === 'any' || (state === 'yes') === value;
}

/** Lower-cases and strips diacritics so "qualité" matches "qualite". */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Parses the search box: space-separated terms are AND-ed, "quoted phrases" stay together,
 * and a leading minus excludes a term.
 */
export function parseSearch(query: string): { include: string[]; exclude: string[] } {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const m of query.matchAll(/(-?)"([^"]+)"|(-?)(\S+)/g)) {
    const negative = (m[1] ?? m[3]) === '-';
    const term = foldText((m[2] ?? m[4] ?? '').trim());
    if (!term || term === '-') continue;
    (negative ? exclude : include).push(term);
  }
  return { include, exclude };
}

export function resolveDateRange(filters: ReviewFilters, now: Date = new Date()): { from?: string; to?: string } {
  if (filters.datePreset === 'all') return {};
  if (filters.datePreset === 'custom') return { from: filters.dateFrom || undefined, to: filters.dateTo || undefined };
  return { from: daysAgo(Number(filters.datePreset), now) };
}

export function matchesFilters(review: Review, filters: ReviewFilters, now: Date = new Date()): boolean {
  if (filters.ratings.length && !filters.ratings.includes(review.rating)) return false;
  if (filters.sentiments.length && !filters.sentiments.includes(effectiveSentiment(review))) return false;
  if (!tri(filters.hasPhotos, review.images.length > 0)) return false;
  if (!tri(filters.hasVideo, review.videos.length > 0)) return false;
  if (!tri(filters.hasText, review.text.trim().length > 0)) return false;
  if (filters.countries.length && !filters.countries.includes(review.country ?? '')) return false;
  if (filters.languages.length && !filters.languages.includes(review.language)) return false;
  if (filters.aspects.length && !filters.aspects.some((a) => review.aspects.includes(a))) return false;
  if (filters.tags.length && !filters.tags.some((t) => review.tags.includes(t))) return false;

  const { from, to } = resolveDateRange(filters, now);
  if (from || to) {
    // A date filter is active: reviews without a date cannot be placed in the range.
    if (!review.date) return false;
    if (from && review.date < from) return false;
    if (to && review.date > to) return false;
  }

  if (filters.search.trim()) {
    const { include, exclude } = parseSearch(filters.search);
    const haystack = foldText(`${review.text}\n${review.variant ?? ''}`);
    if (!include.every((t) => haystack.includes(t))) return false;
    if (exclude.some((t) => haystack.includes(t))) return false;
  }
  return true;
}

export function filterReviews(reviews: Review[], filters: ReviewFilters, now: Date = new Date()): Review[] {
  return reviews.filter((r) => matchesFilters(r, filters, now));
}

export function sortReviews(reviews: Review[], sort: SortState): Review[] {
  const dir = sort.direction === 'asc' ? 1 : -1;
  const value = (r: Review): number | string | undefined => {
    switch (sort.field) {
      case 'rating':
        return r.rating;
      case 'date':
        return r.date;
      case 'helpful':
        return r.helpfulCount;
      case 'length':
        return r.text.length;
    }
  };
  return reviews
    .map((r, i) => ({ r, i, v: value(r) }))
    .sort((a, b) => {
      // Missing values always go last, regardless of direction.
      if (a.v === undefined && b.v === undefined) return a.i - b.i;
      if (a.v === undefined) return 1;
      if (b.v === undefined) return -1;
      if (a.v < b.v) return -dir;
      if (a.v > b.v) return dir;
      // Tie-breaker: newer first, then original order (stable).
      if (sort.field !== 'date' && a.r.date !== b.r.date) return (b.r.date ?? '') < (a.r.date ?? '') ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.r);
}

/** Counts per facet value, used to show "(123)" next to each filter option. */
export function facetCounts(reviews: Review[]) {
  const ratings: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const sentiments: Record<SentimentLabel, number> = { positive: 0, neutral: 0, negative: 0, uncertain: 0 };
  const countries = new Map<string, number>();
  const languages = new Map<string, number>();
  const aspects = new Map<string, number>();
  const tags = new Map<string, number>();
  let photos = 0;
  let videos = 0;
  let withText = 0;
  let withDate = 0;
  for (const r of reviews) {
    ratings[r.rating]++;
    sentiments[effectiveSentiment(r)]++;
    if (r.country) countries.set(r.country, (countries.get(r.country) ?? 0) + 1);
    languages.set(r.language, (languages.get(r.language) ?? 0) + 1);
    for (const a of r.aspects) aspects.set(a, (aspects.get(a) ?? 0) + 1);
    for (const t of r.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
    if (r.images.length) photos++;
    if (r.videos.length) videos++;
    if (r.text.trim()) withText++;
    if (r.date) withDate++;
  }
  return { ratings, sentiments, countries, languages, aspects, tags, photos, videos, withText, withDate, total: reviews.length };
}

export type FacetCounts = ReturnType<typeof facetCounts>;

export function countActiveFilters(filters: ReviewFilters): number {
  let n = 0;
  if (filters.ratings.length) n++;
  if (filters.sentiments.length) n++;
  if (filters.hasPhotos !== 'any') n++;
  if (filters.hasVideo !== 'any') n++;
  if (filters.hasText !== 'any') n++;
  if (filters.countries.length) n++;
  if (filters.languages.length) n++;
  if (filters.datePreset !== 'all') n++;
  if (filters.aspects.length) n++;
  if (filters.tags.length) n++;
  if (filters.search.trim()) n++;
  return n;
}
