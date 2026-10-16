import { useCallback, useRef, useState } from 'react';
import type { Dataset, Review } from '../types/review';
import { randomId } from '../utils/hash';
import { parseProductInput } from '../utils/url';
import { useApp } from './appContext';
import { useI18n, type TFunction } from '../i18n/context';
import type { ProductInputError } from '../utils/url';

export function productInputErrorText(e: ProductInputError, t: TFunction): string {
  switch (e.code) {
    case 'empty':
      return t('url.empty');
    case 'invalid':
      return t('url.invalid');
    case 'domain':
      return t('url.domain', { host: e.host });
    case 'no-id':
      return t('url.noId');
  }
}

export interface AnalyzeProgress {
  productId: string;
  page: number;
  maxPages: number;
  fetched: number;
  /** Total reviews the provider reports for the product, once known. */
  total?: number;
}

/** What fetching every page would take; shown to the user before spending credits. */
export interface FetchPlan {
  total: number;
  totalPages: number;
  pageLimit: number;
  creditsPerPage: number;
  creditsRemaining?: number;
}

/** Resolves to the number of pages to fetch in total (1 = stop after the first page). */
export type ConfirmPlan = (plan: FetchPlan) => Promise<number>;

export type AnalyzeOutcome =
  | { kind: 'error'; message: string }
  | { kind: 'no-source'; productId: string; productUrl: string }
  | { kind: 'existing'; dataset: Dataset }
  | { kind: 'fetched'; dataset: Dataset }
  | { kind: 'cancelled' };

/**
 * "Analyze Reviews" from the header. Uses the configured data provider when it is
 * connected; otherwise reports that a source is needed (it never fabricates data).
 */
export function useAnalyze() {
  const { connection, provider, settings, datasets, saveDataset, setActiveDataset } = useApp();
  const { t } = useI18n();
  const [progress, setProgress] = useState<AnalyzeProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Credits left after the last run, for the success message. */
  const lastCredits = useRef<number | undefined>(undefined);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const analyze = useCallback(
    async (input: string, confirmPlan?: ConfirmPlan): Promise<AnalyzeOutcome> => {
      const parsed = parseProductInput(input);
      if ('error' in parsed) return { kind: 'error', message: productInputErrorText(parsed, t) };
      const { productId, canonicalUrl } = parsed;

      if (connection?.state !== 'connected' || !provider.fetchReviews) {
        const existing = datasets.find((d) => d.productId === productId);
        if (existing) {
          setActiveDataset(existing.id);
          return { kind: 'existing', dataset: existing };
        }
        return { kind: 'no-source', productId, productUrl: canonicalUrl };
      }

      const controller = new AbortController();
      abortRef.current = controller;
      const datasetId = randomId('ds');
      const reviews: Review[] = [];
      const seen = new Set<string>();
      const notes: string[] = [];
      let skipped = 0;
      let hasMore = false;
      let total: number | undefined;
      let creditsUsed = 0;
      let creditsRemaining: number | undefined;
      let page = 1;
      let pageLimit = settings.maxPages;
      let totalPages: number | undefined;
      try {
        for (; page <= pageLimit; page++) {
          setProgress({ productId, page, maxPages: totalPages !== undefined ? Math.min(pageLimit, totalPages) : pageLimit, fetched: reviews.length, total });
          const result = await provider.fetchReviews(productId, page, { datasetId, signal: controller.signal });
          skipped += result.report.skipped;
          for (const r of result.reviews) {
            if (seen.has(r.id)) continue;
            seen.add(r.id);
            reviews.push(r);
          }
          hasMore = result.pagination.hasMore;
          total = result.pagination.totalReviews ?? total;
          creditsUsed += result.creditsUsed ?? 0;
          creditsRemaining = result.creditsRemaining ?? creditsRemaining;
          totalPages = result.pagination.totalPages ?? totalPages;
          if (!hasMore || result.reviews.length === 0) break;
          // After the first page the total is known: let the user decide how many credits to spend.
          // Small products (≤ 5 pages ≈ 25 credits) are fetched without asking.
          if (page === 1 && confirmPlan && total !== undefined && totalPages !== undefined && totalPages > 5) {
            setProgress(null);
            const chosen = await confirmPlan({
              total,
              totalPages,
              pageLimit: Math.min(settings.maxPages, totalPages),
              creditsPerPage: result.creditsUsed ?? 5,
              creditsRemaining,
            });
            if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            pageLimit = Math.max(1, Math.min(chosen, totalPages));
          }
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          setProgress(null);
          return { kind: 'cancelled' };
        }
        if (!reviews.length) {
          setProgress(null);
          return { kind: 'error', message: (e as Error).message };
        }
        notes.push(t('note.stoppedEarly', { page, detail: (e as Error).message }));
        hasMore = true;
      } finally {
        abortRef.current = null;
      }
      setProgress(null);

      const pagesFetched = Math.min(page, pageLimit);
      if (hasMore) notes.push(t('note.pageLimit', { pages: pagesFetched }));
      if (skipped) notes.push(t('note.skippedRows', { count: skipped }));
      if (total !== undefined) notes.push(t('note.providerTotal', { total, fetched: reviews.length }));
      if (creditsUsed || creditsRemaining !== undefined) notes.push(t('note.credits', { used: creditsUsed, remaining: creditsRemaining ?? '?' }));
      const completeness: Dataset['completeness'] = hasMore ? 'partial' : total !== undefined && reviews.length >= total ? 'complete' : 'unknown';
      if (completeness !== 'complete') {
        notes.push(t('note.subset'));
      } else {
        notes.push(t('note.allFetched'));
      }

      const dataset: Dataset = {
        id: datasetId,
        name: t('analyze.datasetName', { id: productId, provider: connection.providerName ?? t('analyze.provider') }),
        origin: 'api',
        sourceLabel: connection.providerName ?? t('analyze.provider'),
        productId,
        productUrl: canonicalUrl,
        createdAt: new Date().toISOString(),
        reviews,
        completeness,
        notes,
      };
      if (!reviews.length) return { kind: 'error', message: t('analyze.noReviews') };
      lastCredits.current = creditsRemaining;
      await saveDataset(dataset);
      setActiveDataset(dataset.id);
      return { kind: 'fetched', dataset };
    },
    [connection, provider, settings.maxPages, datasets, saveDataset, setActiveDataset, t],
  );

  return { analyze, progress, cancel, lastCredits };
}
