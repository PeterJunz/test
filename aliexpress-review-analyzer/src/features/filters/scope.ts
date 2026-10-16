import type { ReviewFilters } from '../../types/filters';

export type Scope = 'all' | 'positive' | 'negative' | 'photos' | 'videos';

/** Which filter fields a scope locks (shown disabled in the filter panel). */
export const SCOPE_LOCKS: Record<Scope, Array<keyof ReviewFilters>> = {
  all: [],
  positive: ['sentiments'],
  negative: ['sentiments'],
  photos: ['hasPhotos'],
  videos: ['hasVideo'],
};

/** Combines the page scope with the user's filters. The scope wins on the field it locks. */
export function applyScope(filters: ReviewFilters, scope: Scope): ReviewFilters {
  switch (scope) {
    case 'positive':
      return { ...filters, sentiments: ['positive'] };
    case 'negative':
      return { ...filters, sentiments: ['negative'] };
    case 'photos':
      return { ...filters, hasPhotos: 'yes' };
    case 'videos':
      return { ...filters, hasVideo: 'yes' };
    default:
      return filters;
  }
}
