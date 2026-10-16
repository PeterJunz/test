import { Quote } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../hooks/appContext';
import type { Dataset, Review } from '../types/review';
import { Badge, Card, Toggle } from '../components/ui';
import { DatasetBanner } from '../components/DatasetBanner';
import { countActiveFilters, filterReviews } from '../features/filters/filterReviews';
import { describeFilters } from '../features/filters/describeFilters';
import { buildRuleSummary, computeAspectInsights, computeTagInsights, type Quote as QuoteT } from '../features/insights/insights';
import { AiPanel } from '../features/insights/AiPanel';
import { ReviewDetail } from '../features/reviews/ReviewDetail';
import { formatCaution, formatSummaryItem } from '../features/insights/formatSummary';
import { useI18n } from '../i18n/context';

function CustomerQuote({ q, onOpen }: { q: QuoteT; onOpen(): void }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-left text-xs text-ink-2 hover:bg-surface-3">
      <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
      <span>
        <span className="font-medium text-ink">{t('quote.customer', { rating: q.rating })}</span> “{q.text}”
      </span>
    </button>
  );
}

export function InsightsPage({ dataset }: { dataset: Dataset }) {
  const { filters, setFilters, navigate } = useApp();
  const { t, lang } = useI18n();
  const [useFilters, setUseFilters] = useState(true);
  const [detail, setDetail] = useState<Review | null>(null);
  const active = countActiveFilters(filters);
  const reviews = useMemo(() => (useFilters ? filterReviews(dataset.reviews, filters) : dataset.reviews), [dataset.reviews, filters, useFilters]);
  const tags = useMemo(() => computeTagInsights(reviews), [reviews]);
  const aspects = useMemo(() => computeAspectInsights(reviews), [reviews]);
  const summary = useMemo(() => buildRuleSummary(reviews, tags), [reviews, tags]);
  const byId = useMemo(() => new Map(dataset.reviews.map((r) => [r.id, r])), [dataset.reviews]);
  const open = (id: string) => {
    const r = byId.get(id);
    if (r) setDetail(r);
  };

  return (
    <div className="space-y-5">
      <DatasetBanner dataset={dataset} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('nav.insights')}</h1>
          <p className="text-sm text-ink-3">
            {t('stat.reviews', { count: reviews.length })} · {useFilters && active ? describeFilters(filters, t, lang) : t('insights.wholeDataset')}
          </p>
        </div>
        <Toggle checked={useFilters && active > 0} disabled={!active} onChange={setUseFilters} label={t('common.applyFilters')} description={active ? t('overview.activeFilters', { count: active }) : t('overview.noFilters')} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title={t('insights.ruleTitle')} subtitle={t('insights.ruleSub', { count: summary.withText })}>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-pos">{t('ai.commonPositives')}</h3>
                {summary.strengths.length ? (
                  <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink">{summary.strengths.map((s) => <li key={s.tag}>{formatSummaryItem(s, t)}</li>)}</ul>
                ) : (
                  <p className="text-sm text-ink-3">{t('insights.noPraise')}</p>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neg">{t('ai.commonComplaints')}</h3>
                {summary.complaints.length ? (
                  <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink">{summary.complaints.map((s) => <li key={s.tag}>{formatSummaryItem(s, t)}</li>)}</ul>
                ) : (
                  <p className="text-sm text-ink-3">{t('insights.noComplaints')}</p>
                )}
              </div>
            </div>
            {summary.cautions.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-warn-ink">
                {summary.cautions.map((c) => (
                  <li key={c.kind}>⚠ {formatCaution(c, t)}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t('insights.themesTitle')} subtitle={t('insights.themesSub')}>
            {tags.length ? (
              <ul className="divide-y divide-line">
                {tags.map((item) => (
                  <li key={item.tag} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge tone={item.polarity === 'positive' ? 'pos' : 'neg'}>{t(item.polarity === 'positive' ? 'insights.praise' : 'insights.complaint')}</Badge>
                        <span className="text-sm font-medium text-ink">{t(`tag.${item.tag}`)}</span>
                      </div>
                      <button
                        type="button"
                        className="tabular text-xs text-brand-ink hover:underline"
                        onClick={() => {
                          setFilters((f) => ({ ...f, tags: [item.tag] }));
                          navigate('all');
                        }}
                      >
                        {t('insights.reviewsPct', { count: item.count, pct: (item.share * 100).toFixed(0) })} →
                      </button>
                    </div>
                    {item.quotes.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.quotes.map((q) => (
                          <CustomerQuote key={q.reviewId} q={q} onOpen={() => open(q.reviewId)} />
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">{t('insights.noThemes')}</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <AiPanel dataset={dataset} reviews={reviews} onOpenReview={setDetail} />
          <Card title={t('insights.aspectsTitle')} subtitle={t('insights.aspectsSub')}>
            {aspects.length ? (
              <ul className="space-y-3.5">
                {aspects.map((a) => {
                  const total = a.mentions || 1;
                  return (
                    <li key={a.aspect}>
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-ink">{t(`aspect.${a.aspect}`)}</span>
                        <span className="tabular text-xs text-ink-2">
                          {t('insights.mentions', { count: a.mentions })} · <span className="text-pos">{a.positive} +</span> / <span className="text-neg">{a.negative} −</span>
                        </span>
                      </div>
                      <div className="mt-1 flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={t('insights.aspectAria', { pos: a.positive, neu: a.neutral, neg: a.negative })}>
                        <div style={{ width: `${(a.positive / total) * 100}%`, background: 'var(--pos)' }} />
                        <div style={{ width: `${(a.neutral / total) * 100}%`, background: 'var(--neu)' }} />
                        <div style={{ width: `${(a.negative / total) * 100}%`, background: 'var(--neg)' }} />
                      </div>
                      {(a.quotes.negative[0] || a.quotes.positive[0]) && (
                        <div className="mt-1.5 space-y-1">
                          {a.quotes.negative[0] && <CustomerQuote q={a.quotes.negative[0]} onOpen={() => open(a.quotes.negative[0].reviewId)} />}
                          {a.quotes.positive[0] && <CustomerQuote q={a.quotes.positive[0]} onOpen={() => open(a.quotes.positive[0].reviewId)} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">{t('insights.noAspects')}</p>
            )}
          </Card>
        </div>
      </div>
      {detail && <ReviewDetail review={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
