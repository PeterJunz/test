import type { Aspect, NegativeTag, PositiveTag, Review, ReviewTag } from '../../types/review';
import { scoreText, splitSentences } from '../../services/sentiment-analysis/analyzer';
import {
  ASPECT_LABELS,
  ASPECT_PATTERNS,
  NEGATIVE_TAG_LABELS,
  NEGATIVE_TAG_PATTERNS,
  POSITIVE_TAG_LABELS,
  POSITIVE_TAG_PATTERNS,
} from '../../services/sentiment-analysis/taxonomy';
import { effectiveSentiment } from '../filters/filterReviews';

export interface Quote {
  reviewId: string;
  rating: number;
  /** Verbatim sentence from the customer's review. */
  text: string;
}

export interface TagInsight {
  tag: ReviewTag;
  label: string;
  polarity: 'positive' | 'negative';
  count: number;
  share: number;
  quotes: Quote[];
}

export interface AspectInsight {
  aspect: Aspect;
  label: string;
  mentions: number;
  positive: number;
  negative: number;
  neutral: number;
  quotes: { positive: Quote[]; negative: Quote[] };
}

export interface SummaryItem {
  tag: ReviewTag;
  count: number;
  withText: number;
  share: number;
}

export type Caution =
  | { kind: 'small-sample'; total: number }
  | { kind: 'little-text'; noText: number; total: number; withText: number }
  | { kind: 'non-english'; count: number }
  | { kind: 'functional-problems' };

/** Structured so the UI can render it in any language; see formatSummary.ts. */
export interface RuleSummary {
  basedOn: number;
  withText: number;
  strengths: SummaryItem[];
  complaints: SummaryItem[];
  cautions: Caution[];
}

const isPositiveTag = (t: ReviewTag): t is PositiveTag => t in POSITIVE_TAG_LABELS;

export function tagLabel(tag: ReviewTag): string {
  return isPositiveTag(tag) ? POSITIVE_TAG_LABELS[tag] : NEGATIVE_TAG_LABELS[tag as NegativeTag];
}

function patternFor(tag: ReviewTag): RegExp {
  return isPositiveTag(tag) ? POSITIVE_TAG_PATTERNS[tag] : NEGATIVE_TAG_PATTERNS[tag as NegativeTag];
}

function quoteFor(review: Review, pattern: RegExp): Quote | undefined {
  const sentence = splitSentences(review.text).find((s) => {
    pattern.lastIndex = 0;
    return pattern.test(s.toLowerCase());
  });
  if (!sentence) return undefined;
  return { reviewId: review.id, rating: review.rating, text: sentence.length > 220 ? `${sentence.slice(0, 217)}…` : sentence };
}

export function computeTagInsights(reviews: Review[], maxQuotes = 3): TagInsight[] {
  const withText = reviews.filter((r) => r.text.trim()).length;
  const byTag = new Map<ReviewTag, Review[]>();
  for (const r of reviews) for (const t of r.tags) byTag.set(t, [...(byTag.get(t) ?? []), r]);
  return [...byTag.entries()]
    .map(([tag, list]) => {
      const pattern = patternFor(tag);
      // Prefer quotes from helpful, longer reviews.
      const ranked = [...list].sort((a, b) => (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0) || b.text.length - a.text.length);
      const quotes: Quote[] = [];
      const seenText = new Set<string>();
      for (const r of ranked) {
        const q = quoteFor(r, pattern);
        if (q && !seenText.has(q.text.toLowerCase())) {
          seenText.add(q.text.toLowerCase());
          quotes.push(q);
        }
        if (quotes.length >= maxQuotes) break;
      }
      return {
        tag,
        label: tagLabel(tag),
        polarity: isPositiveTag(tag) ? ('positive' as const) : ('negative' as const),
        count: list.length,
        share: withText ? list.length / withText : 0,
        quotes,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function computeAspectInsights(reviews: Review[], maxQuotes = 2): AspectInsight[] {
  const result = new Map<Aspect, AspectInsight>();
  for (const r of reviews) {
    if (!r.aspects.length) continue;
    const sentences = splitSentences(r.text);
    for (const aspect of r.aspects) {
      const pattern = ASPECT_PATTERNS[aspect];
      const relevant = sentences.filter((s) => {
        pattern.lastIndex = 0;
        return pattern.test(s.toLowerCase());
      });
      const text = relevant.join(' ');
      const { score, hits } = scoreText(text);
      // Fall back to the review's overall sentiment when the sentence itself is neutral.
      const overall = effectiveSentiment(r);
      const polarity = hits > 0 && Math.abs(score) > 0.2 ? (score > 0 ? 'positive' : 'negative') : overall === 'positive' || overall === 'negative' ? overall : 'neutral';
      const entry = result.get(aspect) ?? {
        aspect,
        label: ASPECT_LABELS[aspect],
        mentions: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        quotes: { positive: [], negative: [] },
      };
      entry.mentions++;
      entry[polarity]++;
      if (polarity !== 'neutral' && relevant[0] && entry.quotes[polarity].length < maxQuotes) {
        const sentence = relevant[0];
        entry.quotes[polarity].push({ reviewId: r.id, rating: r.rating, text: sentence.length > 220 ? `${sentence.slice(0, 217)}…` : sentence });
      }
      result.set(aspect, entry);
    }
  }
  return [...result.values()].sort((a, b) => b.mentions - a.mentions);
}

/**
 * Deterministic, explainable summary built from tag counts. Every item carries the
 * count it is based on, so it is clear this is an inference from the data, not a quote.
 */
export function buildRuleSummary(reviews: Review[], tags: TagInsight[]): RuleSummary {
  const withText = reviews.filter((r) => r.text.trim()).length;
  const minCount = Math.max(2, Math.ceil(withText * 0.03));
  const item = (t: TagInsight): SummaryItem => ({ tag: t.tag, count: t.count, withText, share: t.share });
  const strengths = tags.filter((t) => t.polarity === 'positive' && t.count >= minCount).slice(0, 5).map(item);
  const complaints = tags.filter((t) => t.polarity === 'negative' && t.count >= minCount).slice(0, 6).map(item);
  const cautions: Caution[] = [];
  if (reviews.length < 30) cautions.push({ kind: 'small-sample', total: reviews.length });
  if (withText < reviews.length * 0.4) cautions.push({ kind: 'little-text', noText: reviews.length - withText, total: reviews.length, withText });
  const nonEnglish = reviews.filter((r) => r.text && !['en', 'und'].includes(r.language)).length;
  if (nonEnglish > withText * 0.3) cautions.push({ kind: 'non-english', count: nonEnglish });
  const defects = tags.find((t) => t.tag === 'defective' || t.tag === 'not-working');
  if (defects && defects.share >= 0.05) cautions.push({ kind: 'functional-problems' });
  return { basedOn: reviews.length, withText, strengths, complaints, cautions };
}
