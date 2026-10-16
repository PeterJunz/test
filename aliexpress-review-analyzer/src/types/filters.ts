import type { Aspect, ReviewTag, SentimentLabel, StarRating } from './review';

export type TriState = 'any' | 'yes' | 'no';

export type DatePreset = 'all' | '30' | '90' | '180' | '365' | 'custom';

export interface ReviewFilters {
  ratings: StarRating[];
  sentiments: SentimentLabel[];
  hasPhotos: TriState;
  hasVideo: TriState;
  hasText: TriState;
  countries: string[];
  languages: string[];
  datePreset: DatePreset;
  dateFrom?: string;
  dateTo?: string;
  /** Review must mention at least one of these aspects. */
  aspects: Aspect[];
  /** Review must carry at least one of these tags. */
  tags: ReviewTag[];
  search: string;
}

export type SortField = 'date' | 'rating' | 'helpful' | 'length';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

export const EMPTY_FILTERS: ReviewFilters = {
  ratings: [],
  sentiments: [],
  hasPhotos: 'any',
  hasVideo: 'any',
  hasText: 'any',
  countries: [],
  languages: [],
  datePreset: 'all',
  aspects: [],
  tags: [],
  search: '',
};
