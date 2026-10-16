import { describe, expect, it } from 'vitest';
import { estimateCredits, SOCIALCRAWL_ENDPOINT, SocialCrawlProvider } from './socialCrawlProvider';

/** Shape copied from the documented example response (texts shortened). */
function page(n: number, hasMore: boolean) {
  return {
    success: true,
    platform: 'aliexpress',
    data: {
      items: [
        {
          review: {
            id: `6009752675595854${n}`,
            url: null,
            text: `Great quality, works perfectly ${n}`,
            rating: { value: 5, max: 5 },
            author: { name: 'user_993109', avatar_url: 'https://x.com/a.png', url: 'https://x.com/u', location: 'US' },
            helpful_votes: 3,
            original_language: 'EN',
            translated: true,
            images: ['https://ae01.alicdn.com/kf/a.jpg', 'javascript:alert(1)'],
            published_at: '2026-06-18T00:00:00.000Z',
          },
        },
        { review: { id: `6009407381125040${n}`, text: 'Stopped working after a week', rating: { value: 1, max: 5 }, author: { name: 'user_7f77d6', location: null }, images: [], published_at: '2025-11-29T00:00:00.000Z' } },
      ],
      next_cursor: String(n + 1),
      total: 42,
      dropped: 0,
    },
    credits_used: 5,
    pagination: { next_cursor: 'sc.x', has_more: hasMore, page_size: 20 },
    credits_remaining: 95,
  };
}

function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: init?.headers as Record<string, string> });
    const r = responses.shift()!;
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const config = { apiKey: 'sc_test', language: 'EN' as const, sort: 'newest' as const };

describe('SocialCrawlProvider', () => {
  it('maps documented fields, drops reviewer identity and unsafe URLs', async () => {
    const { impl, calls } = mockFetch([{ status: 200, body: page(1, true) }]);
    const p = new SocialCrawlProvider(config, impl);
    const res = await p.fetchReviews('3256811652350354', 1, { datasetId: 'ds' });

    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe(SOCIALCRAWL_ENDPOINT);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ product_id: '3256811652350354', page: '1', sort_by: 'newest', language: 'EN', label: 'none' });
    expect(calls[0].headers['x-api-key']).toBe('sc_test');

    expect(res.reviews).toHaveLength(2);
    const [a, b] = res.reviews;
    expect(a).toMatchObject({ rating: 5, date: '2026-06-18', country: 'US', helpfulCount: 3, images: ['https://ae01.alicdn.com/kf/a.jpg'], language: 'en' });
    expect(a.sentiment.label).toBe('positive');
    expect(b.rating).toBe(1);
    expect(b.tags).toContain('not-working');
    expect(JSON.stringify(res.reviews)).not.toContain('user_993109');
    expect(res.pagination).toMatchObject({ hasMore: true, totalReviews: 42, totalPages: 3 });
    expect(res.creditsUsed).toBe(5);
    expect(res.creditsRemaining).toBe(95);
  });

  it('reports the end of the list', async () => {
    const { impl } = mockFetch([{ status: 200, body: page(3, false) }]);
    const res = await new SocialCrawlProvider(config, impl).fetchReviews('1', 3, { datasetId: 'ds' });
    expect(res.pagination.hasMore).toBe(false);
  });

  it('validates the key with a free dry run and classifies failures', async () => {
    const ok = mockFetch([{ status: 200, body: { success: true, credits_used: 0 } }]);
    const s1 = await new SocialCrawlProvider(config, ok.impl).validateConnection();
    expect(s1).toMatchObject({ state: 'connected', code: 'sc-connected' });
    expect(new URL(ok.calls[0].url).searchParams.get('dry_run')).toBe('1');

    const bad = mockFetch([{ status: 401, body: { success: false, error: { type: 'INVALID_API_KEY', message: 'Invalid API key.' } } }]);
    const s2 = await new SocialCrawlProvider(config, bad.impl).validateConnection();
    expect(s2).toMatchObject({ state: 'unauthorized', code: 'sc-invalid-key' });
    expect(s2.message).toContain('Invalid API key');

    const none = await new SocialCrawlProvider({ ...config, apiKey: '' }).validateConnection();
    expect(none.code).toBe('sc-missing-key');
  });

  it('surfaces API errors such as exhausted credits', async () => {
    const { impl } = mockFetch([{ status: 402, body: { success: false, error: { type: 'INSUFFICIENT_CREDITS', message: 'Not enough credits.' } } }]);
    await expect(new SocialCrawlProvider(config, impl).fetchReviews('1', 1, { datasetId: 'ds' })).rejects.toThrow(/Not enough credits/);
  });

  it('estimates credits per page of 20', () => {
    expect(estimateCredits(400)).toEqual({ pages: 20, credits: 100 });
    expect(estimateCredits(1)).toEqual({ pages: 1, credits: 5 });
  });
});
