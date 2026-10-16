import { describe, expect, it } from 'vitest';
import { buildReview } from '../review-normalizer/normalize';
import { parseAiResponse, selectReviewsForAi } from './aiClient';

describe('selectReviewsForAi', () => {
  it('sends only id, rating, text and variant for reviews with text', () => {
    const r = [
      buildReview({ datasetId: 'd', rating: 5, text: 'Nice', images: ['https://x.com/a.jpg'], videos: [], country: 'US', variant: 'Black' }),
      buildReview({ datasetId: 'd', rating: 4, text: '', images: [], videos: [] }),
    ];
    const { payload, skippedNoText } = selectReviewsForAi(r);
    expect(skippedNoText).toBe(1);
    expect(Object.keys(payload[0]).sort()).toEqual(['id', 'rating', 'text', 'variant']);
  });
});

describe('parseAiResponse', () => {
  it('drops review ids that were not sent and points left without evidence', () => {
    const sent = [{ id: 'r1', rating: 5, text: 'a' }, { id: 'r2', rating: 1, text: 'b' }];
    const { analysis, sentiments } = parseAiResponse(
      {
        model: 'm',
        result: {
          summary: 'S',
          common_positives: [{ point: 'Good', review_ids: ['r1', 'ghost'] }, { point: 'Invented', review_ids: ['ghost2'] }],
          common_complaints: [],
          sentiments: [{ id: 'r1', label: 'positive', confidence: 1.4 }, { id: 'ghost', label: 'negative', confidence: 0.5 }, { id: 'r2', label: 'weird' }],
        },
      },
      sent,
      'en',
    );
    expect(analysis.commonPositives).toEqual([{ point: 'Good', mentions: 1, reviewIds: ['r1'] }]);
    expect(analysis.discardedIds).toBe(2);
    expect(sentiments.get('r1')).toMatchObject({ label: 'positive', confidence: 1, method: 'ai' });
    expect(sentiments.has('ghost')).toBe(false);
    expect(sentiments.get('r2')?.label).toBe('uncertain');
  });

  it('throws on malformed output', () => {
    expect(() => parseAiResponse({ result: {} }, [], 'en')).toThrow();
  });
});
