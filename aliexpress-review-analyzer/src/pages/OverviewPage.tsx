import { ArrowRight, Camera, MessageSquareText, Star, ThumbsDown, ThumbsUp, Video } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../hooks/appContext';
import type { Dataset } from '../types/review';
import { Card, Toggle } from '../components/ui';
import { DatasetBanner } from '../components/DatasetBanner';
import { RatingDistributionChart, SentimentBar, TrendCharts } from '../features/dashboard/Charts';
import { computeStats, pct } from '../features/dashboard/stats';
import { countActiveFilters, filterReviews } from '../features/filters/filterReviews';
import { describeFilters } from '../features/filters/describeFilters';
import { computeTagInsights } from '../features/insights/insights';
import { formatDate } from '../utils/date';

function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between text-xs font-medium text-ink-2">
        {label}
        <span className="text-ink-3">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

export function OverviewPage({ dataset }: { dataset: Dataset }) {
  const { filters, navigate, setFilters } = useApp();
  const [useFilters, setUseFilters] = useState(false);
  const activeFilters = countActiveFilters(filters);
  const reviews = useMemo(() => (useFilters ? filterReviews(dataset.reviews, filters) : dataset.reviews), [dataset.reviews, filters, useFilters]);
  const stats = useMemo(() => computeStats(reviews), [reviews]);
  const tags = useMemo(() => computeTagInsights(reviews, 0), [reviews]);
  const topNeg = tags.filter((t) => t.polarity === 'negative').slice(0, 5);
  const topPos = tags.filter((t) => t.polarity === 'positive').slice(0, 5);

  return (
    <div className="space-y-5">
      <DatasetBanner dataset={dataset} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-ink-3">
            {useFilters ? `Filtered: ${describeFilters(filters)}` : 'All reviews in this dataset'}
            {stats.firstDate && ` · ${formatDate(stats.firstDate)} – ${formatDate(stats.lastDate)}`}
          </p>
        </div>
        <Toggle checked={useFilters} onChange={setUseFilters} disabled={!activeFilters} label="Apply current filters" description={activeFilters ? `${activeFilters} active filter(s) from the review pages` : 'No filters set on the review pages'} />
      </div>

      {stats.total === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-2">No reviews match the current filters.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
            <Stat label="Reviews analysed" icon={<MessageSquareText className="size-4" />} value={stats.total.toLocaleString()} sub={`${stats.withText.toLocaleString()} with text`} />
            <Stat
              label="Average rating"
              icon={<Star className="size-4" />}
              value={stats.averageRating?.toFixed(2) ?? '—'}
              sub={stats.usCount ? `US buyers: ${stats.usAverage!.toFixed(2)} (${stats.usCount.toLocaleString()} reviews)` : 'No US reviews in data'}
            />
            <Stat label="Positive" icon={<ThumbsUp className="size-4" />} value={pct(stats.positive, stats.total)} sub={`${stats.positive.toLocaleString()} reviews`} />
            <Stat label="Negative" icon={<ThumbsDown className="size-4" />} value={pct(stats.negative, stats.total)} sub={`${stats.negative.toLocaleString()} reviews · ${stats.uncertain} uncertain`} />
            <Stat label="With photos" icon={<Camera className="size-4" />} value={stats.photos.toLocaleString()} sub={pct(stats.photos, stats.total)} />
            <Stat label="With video" icon={<Video className="size-4" />} value={stats.videos.toLocaleString()} sub={stats.videos ? pct(stats.videos, stats.total) : 'None in source data'} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <Card title="Star distribution" subtitle="Number of reviews per star rating">
              <RatingDistributionChart stats={stats} />
              <div className="mt-4 border-t border-line pt-4">
                <p className="mb-2 text-xs font-medium text-ink-2">Sentiment (text + stars)</p>
                <SentimentBar stats={stats} />
              </div>
            </Card>
            <Card title="Review trend" subtitle={stats.withoutDate ? `${stats.withoutDate.toLocaleString()} reviews without a date are not shown` : 'By month of posting'}>
              {stats.trend.length ? <TrendCharts trend={stats.trend} /> : <p className="py-10 text-center text-sm text-ink-3">The source has no review dates.</p>}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { title: 'Most frequent complaints', list: topNeg, tone: 'bg-neg' },
              { title: 'Most frequent praise', list: topPos, tone: 'bg-pos' },
            ].map(({ title, list, tone }) => (
              <Card
                key={title}
                title={title}
                subtitle="Keyword-detected themes · share of written reviews"
                actions={
                  <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink hover:underline" onClick={() => navigate('insights')}>
                    Insights <ArrowRight className="size-3" />
                  </button>
                }
              >
                {list.length ? (
                  <ul className="space-y-2.5">
                    {list.map((t) => (
                      <li key={t.tag}>
                        <button
                          type="button"
                          className="group w-full text-left"
                          onClick={() => {
                            setFilters((f) => ({ ...f, tags: [t.tag] }));
                            navigate('all');
                          }}
                          title="Show these reviews"
                        >
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="text-ink group-hover:underline">{t.label}</span>
                            <span className="tabular text-xs text-ink-2">
                              {t.count.toLocaleString()} · {(t.share * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-surface-3">
                            <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, t.share * 100)}%` }} />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-3">No recurring themes detected in the written reviews.</p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
