import { describe, expect, it } from 'vitest';
import { en, type MessageKey } from './en';
import { vi } from './vi';
import { translate } from './translate';
import { describeFilters } from '../features/filters/describeFilters';
import { EMPTY_FILTERS } from '../types/filters';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('Vietnamese has every non-plural key and uses the same placeholders', () => {
    for (const key of Object.keys(en) as MessageKey[]) {
      if (key.endsWith('_one')) continue;
      const v = (vi as Record<string, string>)[key];
      expect(v, key).toBeTypeOf('string');
      expect(v.trim(), key).not.toBe('');
      expect(placeholders(v), key).toEqual(placeholders(en[key]));
    }
  });

  it('has no Vietnamese keys that English lacks', () => {
    for (const key of Object.keys(vi)) expect(en, key).toHaveProperty(key);
  });
});

describe('translate', () => {
  it('interpolates and formats numbers per locale', () => {
    expect(translate('en', 'stat.reviews', { count: 1234 })).toBe('1,234 reviews');
    expect(translate('vi', 'stat.reviews', { count: 1234 })).toBe('1.234 đánh giá');
  });

  it('uses the singular variant in English only', () => {
    expect(translate('en', 'stat.reviews', { count: 1 })).toBe('1 review');
    expect(translate('vi', 'stat.reviews', { count: 1 })).toBe('1 đánh giá');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(translate('en', 'url.domain', {})).toBe('"{host}" is not an AliExpress domain.');
  });
});

describe('describeFilters in both languages', () => {
  const f = { ...EMPTY_FILTERS, ratings: [1 as const], hasPhotos: 'yes' as const, countries: ['US'], datePreset: '90' as const };
  it('renders English', () => {
    expect(describeFilters(f, (k, v) => translate('en', k, v), 'en')).toBe('1 stars; with photos; country: United States; last 90 days');
  });
  it('renders Vietnamese', () => {
    expect(describeFilters(f, (k, v) => translate('vi', k, v), 'vi')).toBe('1 sao; có ảnh; quốc gia: Hoa Kỳ; 90 ngày gần nhất');
  });
});
