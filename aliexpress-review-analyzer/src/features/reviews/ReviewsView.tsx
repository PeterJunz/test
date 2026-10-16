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
import { applyScope, SCOPE_LABELS, SCOPE_LOCKS, type Scope } from '../filters/scope';
import { exportReviews, type ExportFormat } from '../export/runExport';
import { tagLabel } from '../insights/insights';
import { ReviewDetail } from './ReviewDetail';
import { Lightbox, Thumb } from './media';

const PAGE_SIZES = [25, 50, 100];

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
      const label = onlySelected ? `${list.length} selected` : `${SCOPE_LABELS[scope]}; ${describeFilters(effective)}`;
      await exportReviews(format, list, dataset, label);
      notify('success', `Exported ${list.length.toLocaleString()} review${list.length === 1 ? '' : 's'} as ${format.toUpperCase()}.`);
    } catch (e) {
      notify('error', `Export failed: ${(e as Error).message}`);
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
                Filters{activeCount > 0 && ` (${activeCount})`}
              </Button>
            )}
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder='Search text… use "phrases" and -exclude'
                aria-label="Search reviews"
                className="h-9 w-full rounded-lg border border-line-strong bg-surface-2 pl-8 pr-8 text-sm focus:border-brand focus:bg-surface focus:outline-none"
              />
              {searchDraft && (
                <button type="button" onClick={() => setSearchDraft('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" aria-label="Clear search">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-ink-2">
              Sort
              <select
                value={`${sort.field}:${sort.direction}`}
                onChange={(e) => {
                  const [field, direction] = e.target.value.split(':') as [SortField, 'asc' | 'desc'];
                  setSort({ field, direction });
                }}
                className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-[13px] text-ink"
              >
                <option value="date:desc">Newest first</option>
                <option value="date:asc">Oldest first</option>
                <option value="rating:desc">Highest rating</option>
                <option value="rating:asc">Lowest rating</option>
                <option value="helpful:desc">Most helpful</option>
                <option value="length:desc">Longest text</option>
              </select>
            </label>
            <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Layout">
              <button type="button" role="radio" aria-checked={layout === 'table'} onClick={() => setLayout('table')} className={`rounded-md p-1.5 ${layout === 'table' ? 'bg-surface-3 text-ink' : 'text-ink-3'}`} aria-label="Table">
                <Rows3 className="size-4" />
              </button>
              <button type="button" role="radio" aria-checked={layout === 'grid'} onClick={() => setLayout('grid')} className={`rounded-md p-1.5 ${layout === 'grid' ? 'bg-surface-3 text-ink' : 'text-ink-3'}`} aria-label="Cards">
                <LayoutGrid className="size-4" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className="mr-1 text-xs text-ink-3">Export {selectedInResults.length ? 'selected' : 'results'}:</span>
              {(['csv', 'json', 'xlsx'] as ExportFormat[]).map((f) => (
                <Button key={f} size="sm" loading={exporting === f} disabled={!results.length || exporting !== null} onClick={() => runExport(f, selectedInResults.length > 0)} icon={<Download className="size-3.5" />}>
                  {f.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
            <p className="text-ink-2" aria-live="polite">
              <strong className="tabular text-ink">{results.length.toLocaleString()}</strong> of {dataset.reviews.length.toLocaleString()} reviews
              <span className="text-ink-3"> · {SCOPE_LABELS[scope]}</span>
            </p>
            {selection.size > 0 ? (
              <p className="flex items-center gap-3 text-ink-2">
                <span className="tabular">{selectedInResults.length.toLocaleString()} selected{hiddenSelection > 0 && ` (+${hiddenSelection} hidden by filters)`}</span>
                {!allResultsSelected && (
                  <button type="button" className="font-medium text-brand-ink hover:underline" onClick={() => setSelection(new Set([...selection, ...results.map((r) => r.id)]))}>
                    Select all {results.length.toLocaleString()} filtered results
                  </button>
                )}
                <button type="button" className="text-ink-3 hover:text-ink" onClick={() => setSelection(new Set())}>
                  Clear selection
                </button>
              </p>
            ) : (
              results.length > 0 && (
                <button type="button" className="text-xs font-medium text-brand-ink hover:underline" onClick={() => setSelection(new Set(results.map((r) => r.id)))}>
                  Select all {results.length.toLocaleString()} filtered results
                </button>
              )
            )}
          </div>

          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-sm text-ink-2">
              {scope === 'videos' && counts.videos === 0
                ? 'This dataset contains no video reviews. Video is only available when the data source provides video URLs.'
                : scope === 'photos' && counts.photos === 0
                  ? 'This dataset contains no reviews with photos, or the source did not include image URLs.'
                  : 'No reviews match these filters.'}
            </div>
          ) : layout === 'table' ? (
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[860px] table-fixed text-[13px]">
                <thead className="border-b border-line bg-surface-2 text-xs text-ink-3">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2.5">
                      <input type="checkbox" aria-label="Select reviews on this page" className="size-4 accent-[var(--brand)]" checked={allVisibleSelected} onChange={toggleVisible} />
                    </th>
                    <SortHeader field="rating" label="Rating" className="w-[92px]" />
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">Review</th>
                    <th scope="col" className="w-[104px] px-3 py-2.5 text-left font-medium">Images</th>
                    <th scope="col" className="w-[68px] px-3 py-2.5 text-left font-medium">Country</th>
                    <SortHeader field="date" label="Date" className="w-[100px]" />
                    <th scope="col" className="w-28 px-3 py-2.5 text-left font-medium">Variant</th>
                    <th scope="col" className="w-[116px] px-2 py-2.5 text-left font-medium">Sentiment</th>
                    <th scope="col" className="w-[56px] px-2 py-2.5 text-left font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => (
                    <tr key={r.id} className={`align-top hover:bg-surface-2 ${selection.has(r.id) ? 'bg-brand-soft/40' : ''}`}>
                      <td className="px-3 py-3">
                        <input type="checkbox" aria-label="Select review" className="size-4 accent-[var(--brand)]" checked={selection.has(r.id)} onChange={() => toggleOne(r.id)} />
                      </td>
                      <td className="px-3 py-3">
                        <Stars rating={r.rating} size={12} />
                      </td>
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => setDetail(r)} className="block w-full text-left">
                          {r.text ? <span className="line-clamp-3 text-ink">{r.text}</span> : <span className="italic text-ink-3">No text</span>}
                          {r.tags.length > 0 && (
                            <span className="mt-1.5 flex flex-wrap gap-1">
                              {r.tags.slice(0, 3).map((t) => (
                                <Badge key={t}>{tagLabel(t)}</Badge>
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
                              <Thumb key={src} src={src} alt={`Photo ${i + 1}`} size="sm" onClick={() => setLightbox({ images: r.images, index: i, caption: `${r.rating}★ review` })} />
                            ))}
                            {r.images.length > 2 && <span className="self-center text-xs text-ink-3">+{r.images.length - 2}</span>}
                          </div>
                        ) : r.videos.length ? (
                          <Badge tone="brand">Video</Badge>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3" title={countryName(r.country)}>
                        {r.country ? `${countryFlag(r.country)} ${r.country}` : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="tabular whitespace-nowrap px-3 py-3 text-ink-2">{formatShortDate(r.date)}</td>
                      <td className="px-3 py-3 text-ink-2">
                        <span className="line-clamp-2">{r.variant ?? '—'}</span>
                      </td>
                      <td className="px-2 py-3">
                        <SentimentBadge result={r.aiSentiment ?? r.sentiment} />
                      </td>
                      <td className="px-2 py-3">
                        {r.sourceUrl ? (
                          <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex text-ink-2 hover:text-brand-ink" aria-label="Open original review">
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
                        <Thumb key={src} src={src} alt={`Photo ${i + 1}`} size="lg" onClick={() => setLightbox({ images: r.images, index: i, caption: `${r.rating}★ review` })} />
                      ))}
                    </div>
                  ) : (
                    <div className="m-2 rounded-md bg-surface-2 py-3 text-center text-xs text-ink-3">No photos attached</div>
                  )}
                  <div className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5">
                    <div className="flex items-center justify-between">
                      <Stars rating={r.rating} size={13} />
                      <label className="flex items-center gap-1.5 text-xs text-ink-3">
                        <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={selection.has(r.id)} onChange={() => toggleOne(r.id)} /> Select
                      </label>
                    </div>
                    {r.text ? <p className="line-clamp-4 text-[13px] text-ink">{r.text}</p> : <p className="text-[13px] italic text-ink-3">No text</p>}
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                      <span>{formatDate(r.date)}</span>
                      {r.country && <span>{countryFlag(r.country)} {countryName(r.country)}</span>}
                      {r.variant && <span className="truncate">{r.variant}</span>}
                    </div>
                    <div className="flex items-center justify-between border-t border-line pt-2">
                      <SentimentBadge result={r.aiSentiment ?? r.sentiment} />
                      <div className="flex items-center gap-1">
                        {r.images.length > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => setLightbox({ images: r.images, index: 0, caption: `${r.rating}★ review` })}>
                            View photos
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
                          Details
                        </Button>
                        {r.sourceUrl && (
                          <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="rounded-md p-1.5 text-ink-2 hover:bg-surface-3" aria-label="Open original review">
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
            <nav className="flex items-center justify-between px-1 text-sm text-ink-2" aria-label="Pagination">
              <label className="flex items-center gap-2 text-xs">
                Rows per page
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-8 rounded-md border border-line-strong bg-surface px-1.5">
                  {PAGE_SIZES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2">
                <span className="tabular text-xs">
                  {((current - 1) * pageSize + 1).toLocaleString()}–{Math.min(current * pageSize, results.length).toLocaleString()} of {results.length.toLocaleString()}
                </span>
                <Button size="sm" variant="ghost" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page" icon={<ChevronLeft className="size-4" />} />
                <span className="tabular text-xs">
                  Page {current} / {pages}
                </span>
                <Button size="sm" variant="ghost" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label="Next page" icon={<ChevronRight className="size-4" />} />
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
