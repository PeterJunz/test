import { describe, expect, it } from 'vitest';
import { AE_FEEDBACK_ENDPOINT, AliExpressBlockedError, AliExpressDirectProvider, entryToRow, parseStatistic } from './aliexpressDirectProvider';

/** Synthetic entries in the shape of feedback.aliexpress.com/pc/searchEvaluation.do. */
const entry = (i: number, extra: Record<string, unknown> = {}) => ({
  evaluationIdStr: `6009801185381875${i}`,
  buyerEval: [100, 20, 60, 80][i % 4],
  buyerName: 'U***r',
  buyerHeadPortrait: 'https://ae01.alicdn.com/avatar.jpg',
  buyerGender: 'F',
  buyerCountry: 'US',
  buyerFeedback: 'original text',
  buyerTranslationFeedback: i % 4 === 1 ? 'Stopped working after two days' : 'Great quality, works perfectly',
  evalDate: '10 Jul 2026',
  skuInfo: 'Color:100PCS',
  images: i % 2 ? [] : ['https://ae-pic-a1.aliexpress-media.com/kf/a.jpg'],
  upVoteCount: i,
  ...extra,
});

const body = (page: number, totalPage: number, n: number) => ({
  data: {
    currentPage: page,
    pageSize: 50,
    totalNum: 101,
    totalPage,
    evaViewList: Array.from({ length: n }, (_, i) => entry(page * 100 + i)),
    productEvaluationStatistic: { totalNum: 101, evarageStar: 4.5, fiveStarNum: 80, fourStarNum: 10, threeStarNum: 5, twoStarNum: 2, oneStarNum: 4 },
  },
});

function fakeFetch(responses: Array<{ status?: number; text: string }>) {
  const urls: string[] = [];
  const impl = (async (url: string) => {
    urls.push(url);
    const r = responses.shift()!;
    return new Response(r.text, { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { impl, urls };
}

const deps = (impl: typeof fetch) => ({ fetchImpl: impl, inExtension: () => true, sleep: async () => {} });

describe('entryToRow', () => {
  it('keeps review content, drops identity, appends follow-up feedback', () => {
    const row = entryToRow(entry(0, { buyerAddFbContent: 'Still works after a month' }));
    expect(row.text).toBe('Great quality, works perfectly\n\n[+] Still works after a month');
    expect(JSON.stringify(row)).not.toMatch(/U\*\*\*r|avatar|buyerGender/);
  });
  it('falls back to the original text when there is no translation', () => {
    expect(entryToRow(entry(0, { buyerTranslationFeedback: '' })).text).toBe('original text');
  });
});

describe('AliExpressDirectProvider', () => {
  it('maps the feed (100-point stars, dates, variant, images) and paginates', async () => {
    const { impl, urls } = fakeFetch([{ text: JSON.stringify(body(1, 3, 50)) }]);
    const p = new AliExpressDirectProvider('en_US', deps(impl));
    const res = await p.fetchReviews('3256811652350354', 1, { datasetId: 'ds' });
    const u = new URL(urls[0]);
    expect(u.origin + u.pathname).toBe(AE_FEEDBACK_ENDPOINT);
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ productId: '3256811652350354', page: '1', pageSize: '50', lang: 'en_US' });
    expect(res.reviews).toHaveLength(50);
    expect(res.reviews[0]).toMatchObject({ rating: 5, date: '2026-07-10', country: 'US', variant: 'Color:100PCS', images: ['https://ae-pic-a1.aliexpress-media.com/kf/a.jpg'] });
    expect(res.reviews[1]).toMatchObject({ rating: 1 });
    expect(res.reviews[1].tags).toContain('not-working');
    expect(res.pagination).toMatchObject({ hasMore: true, totalReviews: 101, totalPages: 3 });
    expect(p.statistic).toMatchObject({ total: 101, stars: { 5: 80, 1: 4 } });
  });

  it('stops at the last page', async () => {
    const { impl } = fakeFetch([{ text: JSON.stringify(body(3, 3, 1)) }]);
    const res = await new AliExpressDirectProvider('en_US', deps(impl)).fetchReviews('1', 3, { datasetId: 'ds' });
    expect(res.pagination.hasMore).toBe(false);
  });

  it('stops (never bypasses) when AliExpress serves a verification page', async () => {
    const { impl } = fakeFetch([{ status: 200, text: '<html><script>window._____tmd_____ = true; // punish captcha</script></html>' }]);
    await expect(new AliExpressDirectProvider('en_US', deps(impl)).fetchReviews('1', 1, { datasetId: 'ds' })).rejects.toBeInstanceOf(AliExpressBlockedError);
  });

  it('waits at least one second between requests', async () => {
    const waits: number[] = [];
    const { impl } = fakeFetch([{ text: JSON.stringify(body(1, 2, 2)) }, { text: JSON.stringify(body(2, 2, 2)) }]);
    const p = new AliExpressDirectProvider('en_US', { fetchImpl: impl, inExtension: () => true, sleep: async (ms) => void waits.push(ms) });
    await p.fetchReviews('1', 1, { datasetId: 'ds' });
    await p.fetchReviews('1', 2, { datasetId: 'ds' });
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThan(900);
  });

  it('reports that a normal web page cannot use this source', async () => {
    const p = new AliExpressDirectProvider('en_US', { inExtension: () => false });
    expect((await p.validateConnection()).code).toBe('ae-needs-extension');
    await expect(p.fetchReviews('1', 1, { datasetId: 'ds' })).rejects.toThrow(/extension/);
  });

  it('parses the star statistic', () => {
    expect(parseStatistic(undefined)).toBeUndefined();
  });
});
