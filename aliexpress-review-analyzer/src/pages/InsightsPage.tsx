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

function CustomerQuote({ q, onOpen }: { q: QuoteT; onOpen(): void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-left text-xs text-ink-2 hover:bg-surface-3">
      <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
      <span>
        <span className="font-medium text-ink">{q.rating}★ customer:</span> “{q.text}”
      </span>
    </button>
  );
}

export function InsightsPage({ dataset }: { dataset: Dataset }) {
  const { filters, setFilters, navigate } = useApp();
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
          <h1 className="text-xl font-semibold tracking-tight">Review insights</h1>
          <p className="text-sm text-ink-3">
            {reviews.length.toLocaleString()} reviews · {useFilters && active ? describeFilters(filters) : 'whole dataset'}
          </p>
        </div>
        <Toggle checked={useFilters && active > 0} disabled={!active} onChange={setUseFilters} label="Apply current filters" description={active ? `${active} active filter(s)` : 'No filters set'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title="Rule-based summary" subtitle={`Inference from keyword counts across ${summary.withText.toLocaleString()} written reviews — not a quote`}>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-pos">Common positive feedback</h3>
                {summary.strengths.length ? (
                  <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink">{summary.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
                ) : (
                  <p className="text-sm text-ink-3">No recurring praise detected.</p>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neg">Common complaints</h3>
                {summary.complaints.length ? (
                  <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink">{summary.complaints.map((s) => <li key={s}>{s}</li>)}</ul>
                ) : (
                  <p className="text-sm text-ink-3">No recurring complaints detected.</p>
                )}
              </div>
            </div>
            {summary.cautions.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-warn-ink">
                {summary.cautions.map((c) => (
                  <li key={c}>⚠ {c}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Feedback themes" subtitle="Detected by keyword rules. Quotes are verbatim customer text.">
            {tags.length ? (
              <ul className="divide-y divide-line">
                {tags.map((t) => (
                  <li key={t.tag} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge tone={t.polarity === 'positive' ? 'pos' : 'neg'}>{t.polarity === 'positive' ? 'Praise' : 'Complaint'}</Badge>
                        <span className="text-sm font-medium text-ink">{t.label}</span>
                      </div>
                      <button
                        type="button"
                        className="tabular text-xs text-brand-ink hover:underline"
                        onClick={() => {
                          setFilters((f) => ({ ...f, tags: [t.tag] }));
                          navigate('all');
                        }}
                      >
                        {t.count.toLocaleString()} reviews ({(t.share * 100).toFixed(0)}%) →
                      </button>
                    </div>
                    {t.quotes.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {t.quotes.map((q) => (
                          <CustomerQuote key={q.reviewId} q={q} onOpen={() => open(q.reviewId)} />
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">No themes detected. Text may be missing or in a language the rules do not cover — try AI analysis.</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <AiPanel dataset={dataset} reviews={reviews} onOpenReview={setDetail} />
          <Card title="Product aspects" subtitle="How often each aspect is mentioned, and the tone of those sentences">
            {aspects.length ? (
              <ul className="space-y-3.5">
                {aspects.map((a) => {
                  const total = a.mentions || 1;
                  return (
                    <li key={a.aspect}>
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-ink">{a.label}</span>
                        <span className="tabular text-xs text-ink-2">
                          {a.mentions.toLocaleString()} mentions · <span className="text-pos">{a.positive} +</span> / <span className="text-neg">{a.negative} −</span>
                        </span>
                      </div>
                      <div className="mt-1 flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${a.positive} positive, ${a.neutral} neutral, ${a.negative} negative`}>
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
              <p className="text-sm text-ink-3">No aspect mentions detected.</p>
            )}
          </Card>
        </div>
      </div>
      {detail && <ReviewDetail review={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
