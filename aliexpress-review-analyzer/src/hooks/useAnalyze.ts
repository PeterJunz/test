import { useCallback, useRef, useState } from 'react';
import type { Dataset, Review } from '../types/review';
import { randomId } from '../utils/hash';
import { parseProductInput } from '../utils/url';
import { useApp } from './appContext';

export interface AnalyzeProgress {
  productId: string;
  page: number;
  maxPages: number;
  fetched: number;
}

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
  const [progress, setProgress] = useState<AnalyzeProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const analyze = useCallback(
    async (input: string): Promise<AnalyzeOutcome> => {
      const parsed = parseProductInput(input);
      if ('error' in parsed) return { kind: 'error', message: parsed.error };
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
      let page = 1;
      try {
        for (; page <= settings.maxPages; page++) {
          setProgress({ productId, page, maxPages: settings.maxPages, fetched: reviews.length });
          const result = await provider.fetchReviews(productId, page, { datasetId, signal: controller.signal });
          skipped += result.report.skipped;
          for (const r of result.reviews) {
            if (seen.has(r.id)) continue;
            seen.add(r.id);
            reviews.push(r);
          }
          hasMore = result.pagination.hasMore;
          total = result.pagination.totalReviews ?? total;
          if (!hasMore || result.reviews.length === 0) break;
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
        notes.push(`Stopped early on page ${page}: ${(e as Error).message}`);
        hasMore = true;
      } finally {
        abortRef.current = null;
      }
      setProgress(null);

      const pagesFetched = Math.min(page, settings.maxPages);
      if (hasMore) notes.push(`Stopped after ${pagesFetched} page(s) (limit set in Settings). More reviews are available from the provider.`);
      if (skipped) notes.push(`${skipped} provider rows were skipped during normalisation (missing/invalid rating or duplicates).`);
      if (total !== undefined) notes.push(`Provider reports ${total.toLocaleString()} reviews in total; ${reviews.length.toLocaleString()} were fetched.`);
      const completeness: Dataset['completeness'] = hasMore ? 'partial' : total !== undefined && reviews.length >= total ? 'complete' : 'unknown';
      if (completeness !== 'complete') {
        notes.push('Third-party providers usually expose a subset of reviews (e.g. a capped number of pages or a default sort). Treat these results as a sample.');
      } else {
        notes.push('All reviews the provider reports for this product were fetched. The provider’s own coverage of AliExpress may still be incomplete.');
      }

      const dataset: Dataset = {
        id: datasetId,
        name: `Product ${productId} — ${connection.providerName ?? 'data provider'}`,
        origin: 'api',
        sourceLabel: connection.providerName ?? 'Licensed data provider',
        productId,
        productUrl: canonicalUrl,
        createdAt: new Date().toISOString(),
        reviews,
        completeness,
        notes,
      };
      if (!reviews.length) return { kind: 'error', message: 'The provider returned no reviews for this product.' };
      await saveDataset(dataset);
      setActiveDataset(dataset.id);
      return { kind: 'fetched', dataset };
    },
    [connection, provider, settings.maxPages, datasets, saveDataset, setActiveDataset],
  );

  return { analyze, progress, cancel };
}
