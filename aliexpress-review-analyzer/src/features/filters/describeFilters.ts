import type { ReviewFilters } from '../../types/filters';
import { ASPECT_LABELS } from '../../services/sentiment-analysis/taxonomy';
import { countryName } from '../../utils/country';
import { languageName } from '../../utils/language';
import { tagLabel } from '../insights/insights';

/** Human-readable summary of active filters, used in exports and reports. */
export function describeFilters(f: ReviewFilters): string {
  const parts: string[] = [];
  if (f.ratings.length) parts.push(`${[...f.ratings].sort().join('/')} stars`);
  if (f.sentiments.length) parts.push(`sentiment: ${f.sentiments.join(', ')}`);
  if (f.hasPhotos !== 'any') parts.push(f.hasPhotos === 'yes' ? 'with photos' : 'without photos');
  if (f.hasVideo !== 'any') parts.push(f.hasVideo === 'yes' ? 'with video' : 'without video');
  if (f.hasText !== 'any') parts.push(f.hasText === 'yes' ? 'with text' : 'without text');
  if (f.countries.length) parts.push(`country: ${f.countries.map(countryName).join(', ')}`);
  if (f.languages.length) parts.push(`language: ${f.languages.map(languageName).join(', ')}`);
  if (f.datePreset === 'custom') parts.push(`dates ${f.dateFrom || '…'} to ${f.dateTo || '…'}`);
  else if (f.datePreset !== 'all') parts.push(`last ${f.datePreset} days`);
  if (f.aspects.length) parts.push(`mentions ${f.aspects.map((a) => ASPECT_LABELS[a]).join(' or ')}`);
  if (f.tags.length) parts.push(`themes: ${f.tags.map(tagLabel).join(' or ')}`);
  if (f.search.trim()) parts.push(`search "${f.search.trim()}"`);
  return parts.length ? parts.join('; ') : 'all reviews (no filters)';
}
