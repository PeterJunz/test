import { PanelLeftClose, RotateCcw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { EMPTY_FILTERS, type DatePreset, type ReviewFilters, type TriState } from '../../types/filters';
import type { Aspect, NegativeTag, PositiveTag, SentimentLabel, StarRating } from '../../types/review';
import { ASPECT_LABELS, NEGATIVE_TAG_LABELS, POSITIVE_TAG_LABELS } from '../../services/sentiment-analysis/taxonomy';
import { countryFlag, countryName } from '../../utils/country';
import { languageName } from '../../utils/language';
import { Chip, inputClass, Stars } from '../../components/ui';
import { SENTIMENT_LABEL } from '../../components/labels';
import { countActiveFilters, type FacetCounts } from './filterReviews';
import { SCOPE_LOCKS, type Scope } from './scope';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <fieldset className="border-b border-line px-4 py-3.5 last:border-b-0">
      <legend className="sr-only">{title}</legend>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3" aria-hidden>
          {title}
        </span>
        {right}
      </div>
      {children}
    </fieldset>
  );
}

function TriSelect({ label, value, onChange, count, disabled }: { label: string; value: TriState; onChange(v: TriState): void; count: number; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-[13px] text-ink-2">
        {label} <span className="tabular text-[11px] text-ink-3">({count.toLocaleString()})</span>
      </span>
      <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label={label}>
        {(['any', 'yes', 'no'] as TriState[]).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`rounded-md px-2 py-0.5 text-xs capitalize disabled:opacity-40 ${value === v ? 'bg-ink text-surface' : 'text-ink-2 hover:text-ink'}`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

const DATE_PRESETS: Array<[DatePreset, string]> = [
  ['all', 'All time'],
  ['30', '30 days'],
  ['90', '90 days'],
  ['180', '6 months'],
  ['365', '12 months'],
  ['custom', 'Custom'],
];

export function FilterPanel({ filters, onChange, counts, scope, onReset, onHide }: { filters: ReviewFilters; onChange(f: ReviewFilters): void; counts: FacetCounts; scope: Scope; onReset(): void; onHide?(): void }) {
  const [showAllCountries, setShowAllCountries] = useState(false);
  const locked = new Set(SCOPE_LOCKS[scope]);
  const set = <K extends keyof ReviewFilters>(key: K, value: ReviewFilters[K]) => onChange({ ...filters, [key]: value });
  const countries = [...counts.countries.entries()].sort((a, b) => b[1] - a[1]);
  const shownCountries = showAllCountries ? countries : countries.slice(0, 10);
  const languages = [...counts.languages.entries()].sort((a, b) => b[1] - a[1]);
  const active = countActiveFilters({ ...filters, ...Object.fromEntries([...locked].map((k) => [k, EMPTY_FILTERS[k]])) });

  return (
    <aside aria-label="Filters" className="w-60 shrink-0 self-start rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Filters {active > 0 && <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] text-white">{active}</span>}</h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onReset} disabled={!active} className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink disabled:opacity-40">
            <RotateCcw className="size-3" aria-hidden /> Reset
          </button>
          {onHide && (
            <button type="button" onClick={onHide} className="text-ink-3 hover:text-ink" aria-label="Hide filters" title="Hide filters">
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>
      </div>

      <Section title="Star rating">
        <div className="space-y-1">
          {([5, 4, 3, 2, 1] as StarRating[]).map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 hover:bg-surface-2">
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={filters.ratings.includes(s)} onChange={() => set('ratings', toggle(filters.ratings, s))} />
              <Stars rating={s} size={13} />
              <span className="ml-auto tabular text-xs text-ink-3">{counts.ratings[s].toLocaleString()}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Sentiment" right={locked.has('sentiments') ? <span className="text-[10px] text-ink-3">set by page</span> : undefined}>
        <div className="flex flex-wrap gap-1.5">
          {(['positive', 'neutral', 'negative', 'uncertain'] as SentimentLabel[]).map((s) => (
            <Chip key={s} active={filters.sentiments.includes(s)} disabled={locked.has('sentiments')} count={counts.sentiments[s]} onClick={() => set('sentiments', toggle(filters.sentiments, s))}>
              {SENTIMENT_LABEL[s]}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-3">Text + stars. 3★ leans neutral; “Uncertain” = text contradicts stars.</p>
      </Section>

      <Section title="Content">
        <TriSelect label="Photos" value={filters.hasPhotos} onChange={(v) => set('hasPhotos', v)} count={counts.photos} disabled={locked.has('hasPhotos')} />
        <TriSelect label="Video" value={filters.hasVideo} onChange={(v) => set('hasVideo', v)} count={counts.videos} disabled={locked.has('hasVideo')} />
        <TriSelect label="Written text" value={filters.hasText} onChange={(v) => set('hasText', v)} count={counts.withText} />
      </Section>

      <Section title="Review date">
        <div className="flex flex-wrap gap-1.5">
          {DATE_PRESETS.map(([p, label]) => (
            <Chip key={p} active={filters.datePreset === p} onClick={() => set('datePreset', p)}>
              {label}
            </Chip>
          ))}
        </div>
        {filters.datePreset === 'custom' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input type="date" aria-label="From date" className={inputClass} value={filters.dateFrom ?? ''} onChange={(e) => set('dateFrom', e.target.value)} />
            <input type="date" aria-label="To date" className={inputClass} value={filters.dateTo ?? ''} onChange={(e) => set('dateTo', e.target.value)} />
          </div>
        )}
        {filters.datePreset !== 'all' && counts.withDate < counts.total && (
          <p className="mt-2 text-[11px] text-ink-3">{(counts.total - counts.withDate).toLocaleString()} reviews without a date are excluded.</p>
        )}
      </Section>

      <Section title="Reviewer country">
        {countries.length ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {shownCountries.map(([code, n]) => (
                <Chip key={code} active={filters.countries.includes(code)} count={n} onClick={() => set('countries', toggle(filters.countries, code))}>
                  <span aria-hidden>{countryFlag(code)}</span> {/^[A-Z]{2}$/.test(code) ? code : countryName(code)}
                </Chip>
              ))}
            </div>
            {countries.length > 10 && (
              <button type="button" className="mt-2 text-xs text-ink-2 underline-offset-2 hover:underline" onClick={() => setShowAllCountries((v) => !v)}>
                {showAllCountries ? 'Show fewer' : `Show all ${countries.length}`}
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-ink-3">The source has no country data.</p>
        )}
      </Section>

      <Section title="Language">
        <div className="flex flex-wrap gap-1.5">
          {languages.map(([code, n]) => (
            <Chip key={code} active={filters.languages.includes(code)} count={n} onClick={() => set('languages', toggle(filters.languages, code))}>
              {languageName(code)}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-3">Detected from text unless the source provides it.</p>
      </Section>

      <Section title="Mentions (any of)">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(ASPECT_LABELS) as Aspect[]).map((a) => (
            <Chip key={a} active={filters.aspects.includes(a)} count={counts.aspects.get(a) ?? 0} onClick={() => set('aspects', toggle(filters.aspects, a))}>
              {ASPECT_LABELS[a]}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Positive themes">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(POSITIVE_TAG_LABELS) as PositiveTag[]).map((t) => (
            <Chip key={t} active={filters.tags.includes(t)} count={counts.tags.get(t) ?? 0} onClick={() => set('tags', toggle(filters.tags, t))}>
              {POSITIVE_TAG_LABELS[t]}
            </Chip>
          ))}
        </div>
      </Section>
      <Section title="Negative themes">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(NEGATIVE_TAG_LABELS) as NegativeTag[]).map((t) => (
            <Chip key={t} active={filters.tags.includes(t)} count={counts.tags.get(t) ?? 0} onClick={() => set('tags', toggle(filters.tags, t))}>
              {NEGATIVE_TAG_LABELS[t]}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-3">Themes are keyword-detected (best in English) and can miss paraphrases.</p>
      </Section>
    </aside>
  );
}
