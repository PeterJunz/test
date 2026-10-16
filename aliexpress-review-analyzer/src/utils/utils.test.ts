import { describe, expect, it } from 'vitest';
import { normalizeCountry } from './country';
import { parseReviewDate, daysAgo } from './date';
import { detectLanguage } from './language';
import { parseProductInput, toSafeHttpUrl } from './url';

describe('parseProductInput', () => {
  it.each([
    ['https://www.aliexpress.com/item/1005006123456789.html', '1005006123456789'],
    ['https://vi.aliexpress.com/item/1005006123456789.html?spm=a2g0o&gatewayAdapt=glo2vnm', '1005006123456789'],
    ['aliexpress.us/item/3256805123456789.html', '3256805123456789'],
    ['https://m.aliexpress.com/i/1005006123456789.html', '1005006123456789'],
    ['1005006123456789', '1005006123456789'],
  ])('extracts the id from %s', (input, id) => {
    const parsed = parseProductInput(input);
    expect('productId' in parsed && parsed.productId).toBe(id);
  });

  it.each(['', 'https://amazon.com/item/1005006123456789.html', 'https://www.aliexpress.com/store/123', 'javascript:alert(1)', 'abc'])('rejects %j', (input) => {
    expect('error' in parseProductInput(input)).toBe(true);
  });
});

describe('toSafeHttpUrl', () => {
  it('accepts http(s) and protocol-relative URLs only', () => {
    expect(toSafeHttpUrl('//ae01.alicdn.com/kf/x.jpg')).toBe('https://ae01.alicdn.com/kf/x.jpg');
    expect(toSafeHttpUrl('https://a.com/x')).toBe('https://a.com/x');
    expect(toSafeHttpUrl('javascript:alert(1)')).toBeUndefined();
    expect(toSafeHttpUrl('data:image/png;base64,AAA')).toBeUndefined();
    expect(toSafeHttpUrl('/relative.jpg')).toBeUndefined();
    expect(toSafeHttpUrl(42)).toBeUndefined();
  });
});

describe('parseReviewDate', () => {
  it.each([
    ['2026-03-05', '2026-03-05'],
    ['2026-03-05T10:00:00Z', '2026-03-05'],
    ['2026/3/5', '2026-03-05'],
    ['05 Mar 2026', '2026-03-05'],
    ['Mar 5, 2026', '2026-03-05'],
    ['25/12/2025', '2025-12-25'],
    ['12/25/2025', '2025-12-25'],
    [1767225600, '2026-01-01'],
    ['1767225600000', '2026-01-01'],
  ])('parses %j', (input, expected) => {
    expect(parseReviewDate(input)).toBe(expected);
  });

  it('resolves ambiguous dates with the configured order', () => {
    expect(parseReviewDate('03/04/2026', 'MDY')).toBe('2026-03-04');
    expect(parseReviewDate('03/04/2026', 'DMY')).toBe('2026-04-03');
  });

  it.each(['2026-02-30', '31/31/2026', 'yesterday', '', '1890-01-01'])('rejects %j', (input) => {
    expect(parseReviewDate(input)).toBeUndefined();
  });

  it('computes relative days', () => {
    expect(daysAgo(10, new Date('2026-10-16T05:00:00Z'))).toBe('2026-10-06');
  });
});

describe('normalizeCountry', () => {
  it('maps names and codes', () => {
    expect(normalizeCountry('United States')).toBe('US');
    expect(normalizeCountry('us')).toBe('US');
    expect(normalizeCountry('UK')).toBe('GB');
    expect(normalizeCountry('Brasil')).toBe('BR');
    expect(normalizeCountry('')).toBeUndefined();
  });
});

describe('detectLanguage', () => {
  it('identifies common languages and refuses to guess on short text', () => {
    expect(detectLanguage('The product is very good and arrived fast')).toBe('en');
    expect(detectLanguage('El producto es muy bueno y llegó rápido')).toBe('es');
    expect(detectLanguage('Sản phẩm rất tốt, giao hàng nhanh')).toBe('vi');
    expect(detectLanguage('Отличный товар, рекомендую')).toBe('ru');
    expect(detectLanguage('とても良い商品です')).toBe('ja');
    expect(detectLanguage('ok')).toBe('und');
  });
});
