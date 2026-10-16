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
import { useI18n } from '../i18n/context';
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
  const { t, lang, locale } = useI18n();
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
          <h1 className="text-xl font-semibold tracking-tight">{t('nav.overview')}</h1>
          <p className="text-sm text-ink-3">
            {useFilters ? t('overview.filtered', { desc: describeFilters(filters, t, lang) }) : t('overview.allInDataset')}
            {stats.firstDate && ` · ${formatDate(stats.firstDate, locale)} – ${formatDate(stats.lastDate, locale)}`}
          </p>
        </div>
        <Toggle checked={useFilters} onChange={setUseFilters} disabled={!activeFilters} label={t('common.applyFilters')} description={activeFilters ? t('overview.activeFilters', { count: activeFilters }) : t('overview.noFilters')} />
      </div>

      {stats.total === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-2">{t('reviews.noMatch')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
            <Stat label={t('stat.total')} icon={<MessageSquareText className="size-4" />} value={stats.total.toLocaleString()} sub={t('stat.withText', { count: stats.withText })} />
            <Stat
              label={t('stat.avg')}
              icon={<Star className="size-4" />}
              value={stats.averageRating?.toFixed(2) ?? '—'}
              sub={stats.usCount ? t('stat.us', { avg: stats.usAverage!.toFixed(2), count: stats.usCount }) : t('stat.noUs')}
            />
            <Stat label={t('sentiment.positive')} icon={<ThumbsUp className="size-4" />} value={pct(stats.positive, stats.total)} sub={t('stat.reviews', { count: stats.positive })} />
            <Stat label={t('sentiment.negative')} icon={<ThumbsDown className="size-4" />} value={pct(stats.negative, stats.total)} sub={t('stat.negSub', { count: stats.negative, uncertain: stats.uncertain })} />
            <Stat label={t('stat.photos')} icon={<Camera className="size-4" />} value={stats.photos.toLocaleString()} sub={pct(stats.photos, stats.total)} />
            <Stat label={t('stat.videos')} icon={<Video className="size-4" />} value={stats.videos.toLocaleString()} sub={stats.videos ? pct(stats.videos, stats.total) : t('stat.noVideo')} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <Card title={t('overview.distTitle')} subtitle={t('overview.distSub')}>
              <RatingDistributionChart stats={stats} />
              <div className="mt-4 border-t border-line pt-4">
                <p className="mb-2 text-xs font-medium text-ink-2">{t('overview.sentimentTitle')}</p>
                <SentimentBar stats={stats} />
              </div>
            </Card>
            <Card title={t('overview.trendTitle')} subtitle={stats.withoutDate ? t('overview.undated', { count: stats.withoutDate }) : t('overview.byMonth')}>
              {stats.trend.length ? <TrendCharts trend={stats.trend} /> : <p className="py-10 text-center text-sm text-ink-3">{t('overview.noDates')}</p>}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { title: t('overview.topComplaints'), list: topNeg, tone: 'bg-neg' },
              { title: t('overview.topPraise'), list: topPos, tone: 'bg-pos' },
            ].map(({ title, list, tone }) => (
              <Card
                key={title}
                title={title}
                subtitle={t('overview.themesSub')}
                actions={
                  <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink hover:underline" onClick={() => navigate('insights')}>
                    {t('nav.insights')} <ArrowRight className="size-3" />
                  </button>
                }
              >
                {list.length ? (
                  <ul className="space-y-2.5">
                    {list.map((item) => (
                      <li key={item.tag}>
                        <button
                          type="button"
                          className="group w-full text-left"
                          onClick={() => {
                            setFilters((f) => ({ ...f, tags: [item.tag] }));
                            navigate('all');
                          }}
                          title={t('overview.showThese')}
                        >
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="text-ink group-hover:underline">{t(`tag.${item.tag}`)}</span>
                            <span className="tabular text-xs text-ink-2">
                              {item.count.toLocaleString()} · {(item.share * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-surface-3">
                            <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, item.share * 100)}%` }} />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-3">{t('overview.noThemes')}</p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
