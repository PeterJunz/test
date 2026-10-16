import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, ExternalLink, LayoutGrid, PanelLeftOpen, Rows3, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../hooks/appContext';
import { EMPTY_FILTERS, type ReviewFilters, type SortField } from '../../types/filters';
import type { Dataset, Review } from '../../types/review';
import { countryFlag, countryName } from '../../utils/country';
import { formatDate, formatShortDate } from '../../utils/date';
import { Badge, Button, SentimentBadge, Stars } from '../../components/ui';
import { DatasetBanner } from '../../components/DatasetBanner';
import { FilterPanel } from '../filters/FilterPanel';
import { describeFilters } from '../filters/describeFilters';
import { countActiveFilters, facetCounts, filterReviews, sortReviews } from '../filters/filterReviews';
import { applyScope, SCOPE_LOCKS, type Scope } from '../filters/scope';
import { useI18n } from '../../i18n/context';
import { translate } from '../../i18n/translate';
import type { TFunction } from '../../i18n/context';
import { exportReviews, type ExportFormat } from '../export/runExport';
import { ReviewDetail } from './ReviewDetail';
import { Lightbox, Thumb } from './media';

const PAGE_SIZES = [25, 50, 100];

const tEn: TFunction = (key, vars) => translate('en', key, vars);

function SortHeader({ field, label, className = '' }: { field: SortField; label: string; className?: string }) {
  const { sort, setSort } = useApp();
  const active = sort.field === field;
  return (
    <th scope="col" className={`px-3 py-2.5 text-left font-medium ${className}`} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 hover:text-ink ${active ? 'text-ink' : ''}`}
        onClick={() => setSort({ field, direction: active && sort.direction === 'desc' ? 'asc' : 'desc' })}
      >
        {label}
        {active && (sort.direction === 'desc' ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />)}
      </button>
    </th>
  );
}

export function ReviewsView({ dataset, scope }: { dataset: Dataset; scope: Scope }) {
  const { filters, setFilters, resetFilters, sort, setSort, selection, setSelection, notify } = useApp();
  const { t, lang, locale } = useI18n();
  const [pageSize, setPageSize] = useState(25);
  const [detail, setDetail] = useState<Review | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number; caption: string } | null>(null);
  const [layout, setLayout] = useState<'table' | 'grid'>(scope === 'photos' ? 'grid' : 'table');
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [showFilters, setShowFilters] = useState(true);

  // Debounce the search box so typing stays responsive on large datasets.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchDraft ? f : { ...f, search: searchDraft })), 200);
    return () => clearTimeout(t);
  }, [searchDraft, setFilters]);

  const effective = useMemo(() => applyScope(filters, scope), [filters, scope]);
  const activeCount = countActiveFilters(filters);
  // Facet counts use the page scope alone, so an option never shows 0 just because another filter is active.
  const scopedBase = useMemo(() => filterReviews(dataset.reviews, applyScope(EMPTY_FILTERS, scope)), [dataset.reviews, scope]);
  const counts = useMemo(() => facetCounts(scopedBase), [scopedBase]);
  const results = useMemo(() => sortReviews(filterReviews(dataset.reviews, effective), sort), [dataset.reviews, effective, sort]);

  // The page resets to 1 whenever the filters or page size change.
  const pageKey = `${JSON.stringify(effective)}|${pageSize}`;
  const [pageState, setPageState] = useState({ key: pageKey, page: 1 });
  const page = pageState.key === pageKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: pageKey, page: p });
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  const current = Math.min(page, pages);
  const visible = results.slice((current - 1) * pageSize, current * pageSize);
  const resultIds = useMemo(() => new Set(results.map((r) => r.id)), [results]);
  const selectedInResults = useMemo(() => results.filter((r) => selection.has(r.id)), [results, selection]);
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selection.has(r.id));
  const allResultsSelected = results.length > 0 && selectedInResults.length === results.length;

  const toggleOne = (id: string) => {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
  };
  const toggleVisible = () => {
    const next = new Set(selection);
    if (allVisibleSelected) visible.forEach((r) => next.delete(r.id));
    else visible.forEach((r) => next.add(r.id));
    setSelection(next);
  };

  const runExport = async (format: ExportFormat, onlySelected: boolean) => {
    const list = onlySelected ? selectedInResults : results;
    if (!list.length) return;
    setExporting(format);
    try {
      // Export metadata stays in English so files are consistent whatever the UI language.
      const label = onlySelected ? tEn('export.selectedLabel', { count: list.length }) : `${tEn(`scope.${scope}`)}; ${describeFilters(effective, tEn)}`;
      await exportReviews(format, list, dataset, label);
      notify('success', t('export.done', { count: list.length, format: format.toUpperCase() }));
    } catch (e) {
      notify('error', t('export.failed', { detail: (e as Error).message }));
    } finally {
      setExporting(null);
    }
  };

  const hiddenSelection = selection.size - [...selection].filter((id) => resultIds.has(id)).length;

  return (
    <div className="space-y-4">
      <DatasetBanner dataset={dataset} />
      <div className="flex items-start gap-4">
        {showFilters && (
          <FilterPanel
            filters={effective}
            onChange={(f) => setFilters((prev) => keepLocked(f, prev, scope))}
            counts={counts}
            scope={scope}
            onHide={() => setShowFilters(false)}
            onReset={() => {
              resetFilters();
              setSearchDraft('');
            }}
          />
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2.5">
            {!showFilters && (
              <Button size="sm" icon={<PanelLeftOpen className="size-4" />} onClick={() => setShowFilters(true)}>
                {t('filters.title')}{activeCount > 0 && ` (${activeCount})`}
              </Button>
            )}
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder={t('reviews.searchPlaceholder')}
                aria-label={t('reviews.searchAria')}
                className="h-9 w-full rounded-lg border border-line-strong bg-surface-2 pl-8 pr-8 text-sm focus:border-brand focus:bg-surface focus:outline-none"
              />
              {searchDraft && (
                <button type="button" onClick={() => setSearchDraft('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" aria-label={t('reviews.clearSearch')}>
                  <X className="size-4" />
                </button>
              )}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-ink-2">
              {t('reviews.sort')}
              <select
                value={`${sort.field}:${sort.direction}`}
                onChange={(e) => {
                  const [field, direction] = e.target.value.split(':') as [SortField, 'asc' | 'desc'];
                  setSort({ field, direction });
                }}
                className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-[13px] text-ink"
              >
                <option value="date:desc">{t('sort.newest')}</option>
                <option value="date:asc">{t('sort.oldest')}</option>
                <option value="rating:desc">{t('sort.highest')}</option>
                <option value="rating:asc">{t('sort.lowest')}</option>
                <option value="helpful:desc">{t('sort.helpful')}</option>
                <option value="length:desc">{t('sort.longest')}</option>
              </select>
            </label>
            <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label={t('reviews.layout')}>
              <button type="button" role="radio" aria-checked={layout === 'table'} onClick={() => setLayout('table')} className={`rounded-md p-1.5 ${layout === 'table' ? 'bg-surface-3 text-ink' : 'text-ink-3'}`} aria-label={t('reviews.table')}>
                <Rows3 className="size-4" />
              </button>
              <button type="button" role="radio" aria-checked={layout === 'grid'} onClick={() => setLayout('grid')} className={`rounded-md p-1.5 ${layout === 'grid' ? 'bg-surface-3 text-ink' : 'text-ink-3'}`} aria-label={t('reviews.cards')}>
                <LayoutGrid className="size-4" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className="mr-1 text-xs text-ink-3">{t(selectedInResults.length ? 'reviews.exportSelected' : 'reviews.exportResults')}</span>
              {(['csv', 'json', 'xlsx'] as ExportFormat[]).map((f) => (
                <Button key={f} size="sm" loading={exporting === f} disabled={!results.length || exporting !== null} onClick={() => runExport(f, selectedInResults.length > 0)} icon={<Download className="size-3.5" />}>
                  {f.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
            <p className="text-ink-2" aria-live="polite">
              <strong className="tabular text-ink">{results.length.toLocaleString()}</strong> {t('reviews.ofTotal', { total: dataset.reviews.length })}
              <span className="text-ink-3"> · {t(`scope.${scope}`)}</span>
            </p>
            {selection.size > 0 ? (
              <p className="flex items-center gap-3 text-ink-2">
                <span className="tabular">
                  {t('reviews.selected', { count: selectedInResults.length })}
                  {hiddenSelection > 0 && ` ${t('reviews.hiddenSelected', { count: hiddenSelection })}`}
                </span>
                {!allResultsSelected && (
                  <button type="button" className="font-medium text-brand-ink hover:underline" onClick={() => setSelection(new Set([...selection, ...results.map((r) => r.id)]))}>
                    {t('reviews.selectAll', { count: results.length })}
                  </button>
                )}
                <button type="button" className="text-ink-3 hover:text-ink" onClick={() => setSelection(new Set())}>
                  {t('reviews.clearSelection')}
                </button>
              </p>
            ) : (
              results.length > 0 && (
                <button type="button" className="text-xs font-medium text-brand-ink hover:underline" onClick={() => setSelection(new Set(results.map((r) => r.id)))}>
                  {t('reviews.selectAll', { count: results.length })}
                </button>
              )
            )}
          </div>

          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-sm text-ink-2">
              {scope === 'videos' && counts.videos === 0
                ? t('reviews.noVideos')
                : scope === 'photos' && counts.photos === 0
                  ? t('reviews.noPhotos')
                  : t('reviews.noMatch')}
            </div>
          ) : layout === 'table' ? (
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[860px] table-fixed text-[13px]">
                <thead className="border-b border-line bg-surface-2 text-xs text-ink-3">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2.5">
                      <input type="checkbox" aria-label={t('reviews.selectPage')} className="size-4 accent-[var(--brand)]" checked={allVisibleSelected} onChange={toggleVisible} />
                    </th>
                    <SortHeader field="rating" label={t('col.rating')} className="w-[92px] whitespace-nowrap" />
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">{t('col.review')}</th>
                    <th scope="col" className="w-[104px] px-3 py-2.5 text-left font-medium">{t('col.images')}</th>
                    <th scope="col" className="w-[84px] whitespace-nowrap px-3 py-2.5 text-left font-medium">{t('col.country')}</th>
                    <SortHeader field="date" label={t('col.date')} className="w-[96px] whitespace-nowrap" />
                    <th scope="col" className="w-28 px-3 py-2.5 text-left font-medium">{t('col.variant')}</th>
                    <th scope="col" className="w-[116px] px-2 py-2.5 text-left font-medium">{t('col.sentiment')}</th>
                    <th scope="col" className="w-[56px] px-2 py-2.5 text-left font-medium">{t('col.source')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => (
                    <tr key={r.id} className={`align-top hover:bg-surface-2 ${selection.has(r.id) ? 'bg-brand-soft/40' : ''}`}>
                      <td className="px-3 py-3">
                        <input type="checkbox" aria-label={t('reviews.selectOne')} className="size-4 accent-[var(--brand)]" checked={selection.has(r.id)} onChange={() => toggleOne(r.id)} />
                      </td>
                      <td className="px-3 py-3">
                        <Stars rating={r.rating} size={12} />
                      </td>
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => setDetail(r)} className="block w-full text-left">
                          {r.text ? <span className="line-clamp-3 text-ink">{r.text}</span> : <span className="italic text-ink-3">{t('reviews.noText')}</span>}
                          {r.tags.length > 0 && (
                            <span className="mt-1.5 flex flex-wrap gap-1">
                              {r.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag}>{t(`tag.${tag}`)}</Badge>
                              ))}
                              {r.tags.length > 3 && <Badge>+{r.tags.length - 3}</Badge>}
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        {r.images.length ? (
                          <div className="flex gap-1">
                            {r.images.slice(0, 2).map((src, i) => (
                              <Thumb key={src} src={src} alt={t('media.photoN', { n: i + 1 })} size="sm" onClick={() => setLightbox({ images: r.images, index: i, caption: t('media.caption', { rating: r.rating }) })} />
                            ))}
                            {r.images.length > 2 && <span className="self-center text-xs text-ink-3">+{r.images.length - 2}</span>}
                          </div>
                        ) : r.videos.length ? (
                          <Badge tone="brand">{t('filters.video')}</Badge>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3" title={countryName(r.country, lang)}>
                        {r.country ? `${countryFlag(r.country)} ${r.country}` : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="tabular whitespace-nowrap px-3 py-3 text-ink-2">{formatShortDate(r.date, locale)}</td>
                      <td className="px-3 py-3 text-ink-2">
                        <span className="line-clamp-2">{r.variant ?? '—'}</span>
                      </td>
                      <td className="px-2 py-3">
                        <SentimentBadge result={r.aiSentiment ?? r.sentiment} />
                      </td>
                      <td className="px-2 py-3">
                        {r.sourceUrl ? (
                          <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex text-ink-2 hover:text-brand-ink" aria-label={t('reviews.openOriginal')}>
                            <ExternalLink className="size-4" />
                          </a>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {visible.map((r) => (
                <article key={r.id} className={`flex flex-col rounded-xl border bg-surface ${selection.has(r.id) ? 'border-brand' : 'border-line'}`}>
                  {r.images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-1 p-2">
                      {r.images.slice(0, 3).map((src, i) => (
                        <Thumb key={src} src={src} alt={t('media.photoN', { n: i + 1 })} size="lg" onClick={() => setLightbox({ images: r.images, index: i, caption: t('media.caption', { rating: r.rating }) })} />
                      ))}
                    </div>
                  ) : (
                    <div className="m-2 rounded-md bg-surface-2 py-3 text-center text-xs text-ink-3">{t('reviews.noPhotosAttached')}</div>
                  )}
                  <div className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5">
                    <div className="flex items-center justify-between">
                      <Stars rating={r.rating} size={13} />
                      <label className="flex items-center gap-1.5 text-xs text-ink-3">
                        <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={selection.has(r.id)} onChange={() => toggleOne(r.id)} /> {t('reviews.select')}
                      </label>
                    </div>
                    {r.text ? <p className="line-clamp-4 text-[13px] text-ink">{r.text}</p> : <p className="text-[13px] italic text-ink-3">{t('reviews.noText')}</p>}
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                      <span>{formatDate(r.date, locale)}</span>
                      {r.country && <span>{countryFlag(r.country)} {countryName(r.country, lang)}</span>}
                      {r.variant && <span className="truncate">{r.variant}</span>}
                    </div>
                    <div className="flex items-center justify-between border-t border-line pt-2">
                      <SentimentBadge result={r.aiSentiment ?? r.sentiment} />
                      <div className="flex items-center gap-1">
                        {r.images.length > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => setLightbox({ images: r.images, index: 0, caption: t('media.caption', { rating: r.rating }) })}>
                            {t('reviews.viewPhotos')}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
                          {t('reviews.details')}
                        </Button>
                        {r.sourceUrl && (
                          <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="rounded-md p-1.5 text-ink-2 hover:bg-surface-3" aria-label={t('reviews.openOriginal')}>
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <nav className="flex items-center justify-between px-1 text-sm text-ink-2" aria-label={t('pager.aria')}>
              <label className="flex items-center gap-2 text-xs">
                {t('pager.rows')}
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-8 rounded-md border border-line-strong bg-surface px-1.5">
                  {PAGE_SIZES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2">
                <span className="tabular text-xs">
                  {t('pager.range', { from: (current - 1) * pageSize + 1, to: Math.min(current * pageSize, results.length), total: results.length })}
                </span>
                <Button size="sm" variant="ghost" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label={t('pager.prev')} icon={<ChevronLeft className="size-4" />} />
                <span className="tabular text-xs">
                  {t('pager.page', { current, pages })}
                </span>
                <Button size="sm" variant="ghost" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label={t('pager.next')} icon={<ChevronRight className="size-4" />} />
              </div>
            </nav>
          )}
        </div>
      </div>
      {detail && <ReviewDetail review={detail} onClose={() => setDetail(null)} />}
      {lightbox && <Lightbox images={lightbox.images} index={lightbox.index} caption={lightbox.caption} onClose={() => setLightbox(null)} />}
    </div>
  );
}

/** Edits made on a scoped page must not leak the scope's own value into the shared filters. */
function keepLocked(next: ReviewFilters, prev: ReviewFilters, scope: Scope): ReviewFilters {
  const out = { ...next } as Record<string, unknown>;
  for (const key of SCOPE_LOCKS[scope]) out[key] = prev[key];
  return out as unknown as ReviewFilters;
}
