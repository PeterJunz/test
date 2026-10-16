import { AlertTriangle, Bot, Lock, Quote } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useApp } from '../../hooks/appContext';
import type { AiAnalysis, AiEvidencePoint, Dataset, Review } from '../../types/review';
import { requestAiAnalysis, selectReviewsForAi } from '../../services/sentiment-analysis/aiClient';
import { Badge, Button, Card } from '../../components/ui';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';

const SECTIONS: Array<[keyof AiAnalysis, MessageKey]> = [
  ['commonPositives', 'ai.commonPositives'],
  ['commonComplaints', 'ai.commonComplaints'],
  ['recurringDefects', 'ai.recurringDefects'],
  ['materialIssues', 'ai.materialIssues'],
  ['packagingShippingIssues', 'ai.packaging'],
  ['unmetExpectations', 'ai.unmet'],
  ['highlyValued', 'ai.valued'],
];

function Evidence({ point, byId, onOpen }: { point: AiEvidencePoint; byId: Map<string, Review>; onOpen(r: Review): void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const reviews = point.reviewIds.map((id) => byId.get(id)).filter((r): r is Review => Boolean(r));
  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink">
          <Badge tone="brand">{t('ai.inference')}</Badge> <span className="ml-1">{point.point}</span>
        </p>
        <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 text-xs text-ink-2 hover:underline" aria-expanded={open}>
          {t('ai.cited', { count: reviews.length })}
        </button>
      </div>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {reviews.slice(0, 8).map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onOpen(r)} className="flex w-full items-start gap-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-left text-xs text-ink-2 hover:bg-surface-3">
                <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium text-ink">{t('quote.customer', { rating: r.rating })}</span> <span className="line-clamp-2">{r.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function AiPanel({ dataset, reviews, onOpenReview }: { dataset: Dataset; reviews: Review[]; onOpenReview(r: Review): void }) {
  const { settings, secrets, connection, saveDataset, notify, navigate, updateSettings } = useApp();
  const { t } = useI18n();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);
  const selection = useMemo(() => selectReviewsForAi(reviews), [reviews]);
  const byId = useMemo(() => new Map(dataset.reviews.map((r) => [r.id, r])), [dataset.reviews]);
  const ai = dataset.ai;

  const blockers: string[] = [];
  if (!settings.aiEnabled) blockers.push(t('ai.blockOff'));
  else if (!settings.aiConsent) blockers.push(t('ai.blockConsent'));
  if (!secrets.accessToken || !settings.proxyUrl) blockers.push(t('ai.blockProxy'));
  else if (connection && !['connected', 'not-configured'].includes(connection.state)) blockers.push(t('ai.blockProxyState', { detail: connection.message }));

  const run = async () => {
    setError(undefined);
    setRunning(true);
    abortRef.current = new AbortController();
    try {
      const { analysis, sentiments } = await requestAiAnalysis(
        { baseUrl: settings.proxyUrl, accessToken: secrets.accessToken, anthropicKey: secrets.anthropicKey || undefined, language: settings.aiLanguage },
        selection.payload,
        abortRef.current.signal,
      );
      const updated: Dataset = {
        ...dataset,
        ai: analysis,
        reviews: dataset.reviews.map((r) => (sentiments.has(r.id) ? { ...r, aiSentiment: sentiments.get(r.id) } : r)),
      };
      await saveDataset(updated);
      notify('success', `${t('ai.done', { count: analysis.reviewCount })}${analysis.discardedIds ? ` ${t('ai.discarded', { count: analysis.discardedIds })}` : ''}`);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const clearAi = async () => {
    await saveDataset({ ...dataset, ai: undefined, reviews: dataset.reviews.map((r) => ({ ...r, aiSentiment: undefined })) });
  };

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <Bot className="size-4" aria-hidden /> {t('ai.title')}
        </span>
      }
      subtitle={t('ai.subtitle')}
      actions={ai && <Button size="sm" variant="ghost" onClick={clearAi}>{t('ai.clear')}</Button>}
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-surface-2 p-3 text-xs text-ink-2">
          <p className="flex items-center gap-1.5 font-medium text-ink">
            <Lock className="size-3.5" aria-hidden /> {t('ai.whatSent')}
          </p>
          <p className="mt-1">
            {t('ai.sentBody', { count: selection.payload.length })}
            {selection.skippedNoText > 0 && ` ${t('ai.noTextSkipped', { count: selection.skippedNoText })}`}
            {selection.truncated && ` ${t('ai.truncated')}`}
          </p>
        </div>

        {blockers.length > 0 ? (
          <div className="space-y-2">
            {blockers.map((b) => (
              <p key={b} className="flex items-start gap-2 text-sm text-ink-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn-ink" aria-hidden />
                {b}
              </p>
            ))}
            <Button size="sm" onClick={() => navigate('settings')}>{t('ai.openSettings')}</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" loading={running} disabled={!selection.payload.length} onClick={run} icon={<Bot className="size-4" />}>
              {t(ai ? 'ai.rerun' : 'ai.run', { count: selection.payload.length })}
            </Button>
            {running && <Button onClick={() => abortRef.current?.abort()}>{t('common.cancel')}</Button>}
            <label className="flex items-center gap-1.5 text-xs text-ink-2">
              {t('ai.language')}
              <select value={settings.aiLanguage} onChange={(e) => updateSettings({ aiLanguage: e.target.value as 'en' | 'vi' })} className="h-8 rounded-md border border-line-strong bg-surface px-1.5 text-ink">
                <option value="en">English</option>
                <option value="vi">Tiếng Việt</option>
              </select>
            </label>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-neg-soft px-3 py-2 text-sm text-neg">
            {error}
          </p>
        )}

        {ai && (
          <div className="space-y-4 border-t border-line pt-4">
            <p className="text-xs text-ink-3">
              {ai.model} · {t('stat.reviews', { count: ai.reviewCount })} · {new Date(ai.createdAt).toLocaleString()}
              {ai.discardedIds > 0 && ` · ${t('ai.discarded', { count: ai.discardedIds })}`}
            </p>
            <div className="rounded-lg border border-brand/30 bg-brand-soft/40 p-3.5">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-ink">{t('ai.summary')}</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{ai.summary}</p>
            </div>
            {SECTIONS.map(([key, label]) => {
              const items = ai[key] as AiEvidencePoint[];
              if (!items.length) return null;
              return (
                <section key={key}>
                  <h3 className="mb-2 text-sm font-semibold text-ink">{t(label)}</h3>
                  <ul className="space-y-2">
                    {items.map((p) => (
                      <Evidence key={p.point} point={p} byId={byId} onOpen={onOpenReview} />
                    ))}
                  </ul>
                </section>
              );
            })}
            <p className="text-xs text-ink-3">{t('ai.disclaimer')}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
