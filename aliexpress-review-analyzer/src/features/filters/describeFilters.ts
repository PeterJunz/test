import type { TFunction } from '../../i18n/context';
import type { ReviewFilters } from '../../types/filters';
import { countryName } from '../../utils/country';
import { languageName } from '../../utils/language';

/** Human-readable summary of active filters, used in the UI, exports and reports. */
export function describeFilters(f: ReviewFilters, t: TFunction, lang = 'en'): string {
  const parts: string[] = [];
  if (f.ratings.length) parts.push(t('desc.stars', { stars: [...f.ratings].sort().join('/') }));
  if (f.sentiments.length) parts.push(t('desc.sentiment', { list: f.sentiments.map((s) => t(`sentiment.${s}`)).join(', ') }));
  if (f.hasPhotos !== 'any') parts.push(t(f.hasPhotos === 'yes' ? 'desc.withPhotos' : 'desc.withoutPhotos'));
  if (f.hasVideo !== 'any') parts.push(t(f.hasVideo === 'yes' ? 'desc.withVideo' : 'desc.withoutVideo'));
  if (f.hasText !== 'any') parts.push(t(f.hasText === 'yes' ? 'desc.withText' : 'desc.withoutText'));
  if (f.countries.length) parts.push(t('desc.country', { list: f.countries.map((c) => countryName(c, lang)).join(', ') }));
  if (f.languages.length) parts.push(t('desc.language', { list: f.languages.map((l) => languageName(l, lang)).join(', ') }));
  if (f.datePreset === 'custom') parts.push(t('desc.dateRange', { from: f.dateFrom || '…', to: f.dateTo || '…' }));
  else if (f.datePreset !== 'all') parts.push(t('desc.lastDays', { days: f.datePreset }));
  if (f.aspects.length) parts.push(t('desc.mentions', { list: f.aspects.map((a) => t(`aspect.${a}`)).join(t('desc.or')) }));
  if (f.tags.length) parts.push(t('desc.themes', { list: f.tags.map((x) => t(`tag.${x}`)).join(t('desc.or')) }));
  if (f.search.trim()) parts.push(t('desc.search', { q: f.search.trim() }));
  return parts.length ? parts.join('; ') : t('desc.none');
}
