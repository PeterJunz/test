import { PanelLeftClose, RotateCcw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { EMPTY_FILTERS, type DatePreset, type ReviewFilters, type TriState } from '../../types/filters';
import type { Aspect, NegativeTag, PositiveTag, SentimentLabel, StarRating } from '../../types/review';
import { ASPECT_LABELS, NEGATIVE_TAG_LABELS, POSITIVE_TAG_LABELS } from '../../services/sentiment-analysis/taxonomy';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import { countryFlag, countryName } from '../../utils/country';
import { languageName } from '../../utils/language';
import { Chip, inputClass, Stars } from '../../components/ui';
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
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="min-w-0 text-[13px] leading-tight text-ink-2">
        {label} <span className="tabular whitespace-nowrap text-[11px] text-ink-3">({count.toLocaleString()})</span>
      </span>
      <div className="inline-flex shrink-0 rounded-lg border border-line p-0.5" role="radiogroup" aria-label={label}>
        {(['any', 'yes', 'no'] as TriState[]).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs disabled:opacity-40 ${value === v ? 'bg-ink text-surface' : 'text-ink-2 hover:text-ink'}`}
          >
            {t(`tri.${v}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

const DATE_PRESETS: Array<[DatePreset, MessageKey]> = [
  ['all', 'date.all'],
  ['30', 'date.30'],
  ['90', 'date.90'],
  ['180', 'date.180'],
  ['365', 'date.365'],
  ['custom', 'date.custom'],
];

export function FilterPanel({ filters, onChange, counts, scope, onReset, onHide }: { filters: ReviewFilters; onChange(f: ReviewFilters): void; counts: FacetCounts; scope: Scope; onReset(): void; onHide?(): void }) {
  const { t, lang } = useI18n();
  const [showAllCountries, setShowAllCountries] = useState(false);
  const locked = new Set(SCOPE_LOCKS[scope]);
  const set = <K extends keyof ReviewFilters>(key: K, value: ReviewFilters[K]) => onChange({ ...filters, [key]: value });
  const countries = [...counts.countries.entries()].sort((a, b) => b[1] - a[1]);
  const shownCountries = showAllCountries ? countries : countries.slice(0, 10);
  const languages = [...counts.languages.entries()].sort((a, b) => b[1] - a[1]);
  const active = countActiveFilters({ ...filters, ...Object.fromEntries([...locked].map((k) => [k, EMPTY_FILTERS[k]])) });

  return (
    <aside aria-label={t('filters.title')} className="w-60 shrink-0 self-start rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">{t('filters.title')} {active > 0 && <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] text-white">{active}</span>}</h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onReset} disabled={!active} className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink disabled:opacity-40">
            <RotateCcw className="size-3" aria-hidden /> {t('filters.reset')}
          </button>
          {onHide && (
            <button type="button" onClick={onHide} className="text-ink-3 hover:text-ink" aria-label={t('filters.hide')} title={t('filters.hide')}>
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>
      </div>

      <Section title={t('filters.stars')}>
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

      <Section title={t('filters.sentiment')} right={locked.has('sentiments') ? <span className="text-[10px] text-ink-3">{t('filters.setByPage')}</span> : undefined}>
        <div className="flex flex-wrap gap-1.5">
          {(['positive', 'neutral', 'negative', 'uncertain'] as SentimentLabel[]).map((s) => (
            <Chip key={s} active={filters.sentiments.includes(s)} disabled={locked.has('sentiments')} count={counts.sentiments[s]} onClick={() => set('sentiments', toggle(filters.sentiments, s))}>
              {t(`sentiment.${s}`)}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-3">{t('filters.sentimentHint')}</p>
      </Section>

      <Section title={t('filters.content')}>
        <TriSelect label={t('filters.photos')} value={filters.hasPhotos} onChange={(v) => set('hasPhotos', v)} count={counts.photos} disabled={locked.has('hasPhotos')} />
        <TriSelect label={t('filters.video')} value={filters.hasVideo} onChange={(v) => set('hasVideo', v)} count={counts.videos} disabled={locked.has('hasVideo')} />
        <TriSelect label={t('filters.text')} value={filters.hasText} onChange={(v) => set('hasText', v)} count={counts.withText} />
      </Section>

      <Section title={t('filters.date')}>
        <div className="flex flex-wrap gap-1.5">
          {DATE_PRESETS.map(([p, label]) => (
            <Chip key={p} active={filters.datePreset === p} onClick={() => set('datePreset', p)}>
              {t(label)}
            </Chip>
          ))}
        </div>
        {filters.datePreset === 'custom' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input type="date" aria-label={t('filters.from')} className={inputClass} value={filters.dateFrom ?? ''} onChange={(e) => set('dateFrom', e.target.value)} />
            <input type="date" aria-label={t('filters.to')} className={inputClass} value={filters.dateTo ?? ''} onChange={(e) => set('dateTo', e.target.value)} />
          </div>
        )}
        {filters.datePreset !== 'all' && counts.withDate < counts.total && (
          <p className="mt-2 text-[11px] text-ink-3">{t('filters.undatedExcluded', { count: counts.total - counts.withDate })}</p>
        )}
      </Section>

      <Section title={t('filters.country')}>
        {countries.length ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {shownCountries.map(([code, n]) => (
                <Chip key={code} active={filters.countries.includes(code)} count={n} onClick={() => set('countries', toggle(filters.countries, code))}>
                  <span aria-hidden>{countryFlag(code)}</span> {/^[A-Z]{2}$/.test(code) ? code : countryName(code, lang)}
                </Chip>
              ))}
            </div>
            {countries.length > 10 && (
              <button type="button" className="mt-2 text-xs text-ink-2 underline-offset-2 hover:underline" onClick={() => setShowAllCountries((v) => !v)}>
                {showAllCountries ? t('filters.showFewer') : t('filters.showAll', { count: countries.length })}
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-ink-3">{t('filters.noCountry')}</p>
        )}
      </Section>

      <Section title={t('filters.language')}>
        <div className="flex flex-wrap gap-1.5">
          {languages.map(([code, n]) => (
            <Chip key={code} active={filters.languages.includes(code)} count={n} onClick={() => set('languages', toggle(filters.languages, code))}>
              {languageName(code, lang)}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-3">{t('filters.languageHint')}</p>
      </Section>

      <Section title={t('filters.mentions')}>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(ASPECT_LABELS) as Aspect[]).map((a) => (
            <Chip key={a} active={filters.aspects.includes(a)} count={counts.aspects.get(a) ?? 0} onClick={() => set('aspects', toggle(filters.aspects, a))}>
              {t(`aspect.${a}`)}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title={t('filters.positiveThemes')}>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(POSITIVE_TAG_LABELS) as PositiveTag[]).map((tag) => (
            <Chip key={tag} active={filters.tags.includes(tag)} count={counts.tags.get(tag) ?? 0} onClick={() => set('tags', toggle(filters.tags, tag))}>
              {t(`tag.${tag}`)}
            </Chip>
          ))}
        </div>
      </Section>
      <Section title={t('filters.negativeThemes')}>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(NEGATIVE_TAG_LABELS) as NegativeTag[]).map((tag) => (
            <Chip key={tag} active={filters.tags.includes(tag)} count={counts.tags.get(tag) ?? 0} onClick={() => set('tags', toggle(filters.tags, tag))}>
              {t(`tag.${tag}`)}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-3">{t('filters.themesHint')}</p>
      </Section>
    </aside>
  );
}
