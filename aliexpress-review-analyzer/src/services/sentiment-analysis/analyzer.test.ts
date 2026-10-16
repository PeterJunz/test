import { describe, expect, it } from 'vitest';
import { classifySentiment, detectAspects, detectTags, scoreText } from './analyzer';

describe('scoreText', () => {
  it('scores positive and negative text', () => {
    expect(scoreText('Excellent quality, I love it').score).toBeGreaterThan(0.5);
    expect(scoreText('Terrible, broke after a day').score).toBeLessThan(-0.5);
  });
  it('handles negation', () => {
    expect(scoreText('not good').score).toBeLessThan(0);
    expect(scoreText('does not work').score).toBeLessThan(-0.5);
  });
  it('handles non-English phrases with Unicode boundaries', () => {
    expect(scoreText('не работает').score).toBeLessThan(0);
    expect(scoreText('rất tốt').score).toBeGreaterThan(0);
  });
});

describe('classifySentiment', () => {
  it('uses stars only when there is no text, with modest confidence', () => {
    const s = classifySentiment(5, '', 'und');
    expect(s).toMatchObject({ label: 'positive', method: 'rating-only' });
    expect(s.confidence).toBeLessThanOrEqual(0.7);
    expect(classifySentiment(3, '', 'und').label).toBe('neutral');
    expect(classifySentiment(1, '', 'und').label).toBe('negative');
  });

  it('marks text that contradicts the stars as uncertain', () => {
    expect(classifySentiment(5, 'Terrible, broken and useless. Waste of money.', 'en').label).toBe('uncertain');
    expect(classifySentiment(1, 'Excellent, love it, perfect quality!', 'en').label).toBe('uncertain');
  });

  it('does not trust the lexicon for unsupported languages', () => {
    const s = classifySentiment(4, '非常好的产品', 'zh');
    expect(s.method).toBe('rating-only');
  });

  it('classifies a typical 3-star mixed review as neutral', () => {
    expect(classifySentiment(3, 'It is ok, works but feels cheap.', 'en').label).toBe('neutral');
  });
});

describe('detectTags', () => {
  it('detects positive themes but not when negated', () => {
    expect(detectTags('Good quality and well packaged, arrived on time')).toEqual(expect.arrayContaining(['good-quality', 'good-packaging', 'on-time-delivery']));
    expect(detectTags('Not good quality at all')).not.toContain('good-quality');
    expect(detectTags('It is not as described')).not.toContain('as-described');
  });

  it('detects negative themes', () => {
    const tags = detectTags('Smaller than expected, stopped working after 2 days, missing screws, took 2 months to arrive');
    expect(tags).toEqual(expect.arrayContaining(['wrong-size', 'not-working', 'missing-parts', 'slow-shipping']));
    expect(detectTags('Not as described, waste of money')).toEqual(expect.arrayContaining(['not-as-described', 'not-worth-it']));
  });

  it('returns nothing for empty text', () => {
    expect(detectTags('')).toEqual([]);
  });
});

describe('detectAspects', () => {
  it('finds size, material, shipping, durability', () => {
    expect(detectAspects('The fabric is thin, size runs small, delivery took 20 days and it broke')).toEqual(
      expect.arrayContaining(['material', 'size', 'shipping', 'durability']),
    );
  });
});
