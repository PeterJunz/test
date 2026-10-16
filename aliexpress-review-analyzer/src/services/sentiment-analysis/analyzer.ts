import type {
  Aspect,
  NegativeTag,
  PositiveTag,
  ReviewTag,
  SentimentResult,
  StarRating,
} from '../../types/review';
import { CONTRASTS, INTENSIFIERS, LEXICON, LEXICON_LANGUAGES, NEGATORS, PHRASES } from './lexicon';
import { ASPECT_PATTERNS, NEGATIVE_TAG_PATTERNS, POSITIVE_TAG_PATTERNS } from './taxonomy';

export interface TextScore {
  /** Normalised score in [-1, 1]. */
  score: number;
  /** Number of lexicon / phrase hits that contributed. */
  hits: number;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
}

/** Lexicon score of a piece of text, with negation and intensifier handling. */
export function scoreText(text: string): TextScore {
  let working = text.toLowerCase();
  let raw = 0;
  let hits = 0;

  for (const [pattern, weight] of PHRASES) {
    pattern.lastIndex = 0;
    working = working.replace(pattern, () => {
      raw += weight;
      hits++;
      return ' ';
    });
  }

  const tokens = tokenize(working);
  // Like VADER: sentiment after the last "but" counts more than before it.
  let contrastAt = -1;
  tokens.forEach((t, i) => {
    if (CONTRASTS.has(t)) contrastAt = i;
  });
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const next = tokens[i + 1];
    // A word like "super" is an intensifier when it modifies the next sentiment word.
    if (INTENSIFIERS[token] && next && LEXICON[next] !== undefined) continue;
    const weight = LEXICON[token];
    if (weight === undefined) continue;
    let w = weight;
    const prev = tokens[i - 1];
    if (prev && INTENSIFIERS[prev]) w *= INTENSIFIERS[prev];
    const window = tokens.slice(Math.max(0, i - 3), i);
    if (window.some((t) => NEGATORS.has(t))) w *= -0.75;
    if (contrastAt >= 0) w *= i < contrastAt ? 0.5 : 1.5;
    raw += w;
    hits++;
  }

  const score = raw === 0 ? 0 : raw / Math.sqrt(raw * raw + 6);
  return { score, hits };
}

function ratingOnly(rating: StarRating, reason: string, confidence: number): SentimentResult {
  const label = rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral';
  const extreme = rating === 1 || rating === 5;
  return {
    label,
    confidence: Math.min(confidence + (extreme ? 0.05 : 0), 0.7),
    method: 'rating-only',
    reason,
  };
}

/**
 * Classifies a review. Stars are a prior, the text is the evidence:
 * - no text → stars only, low confidence;
 * - text in an unsupported language or without sentiment words → stars only, flagged;
 * - text that strongly contradicts the stars → `uncertain` (needs a human look);
 * - otherwise a weighted blend of text and stars.
 */
export function classifySentiment(rating: StarRating, text: string, language: string): SentimentResult {
  const trimmed = text.trim();
  if (!trimmed) return ratingOnly(rating, 'No review text — based on the star rating only.', 0.55);

  if (!LEXICON_LANGUAGES.has(language)) {
    return ratingOnly(rating, `Text language (${language}) is not covered by the rule-based model — based on stars only.`, 0.45);
  }

  const { score, hits } = scoreText(trimmed);
  if (hits === 0) {
    return ratingOnly(rating, 'No recognisable sentiment words in the text — based on stars only.', 0.45);
  }

  const prior = (rating - 3) / 2;
  if ((score >= 0.45 && rating <= 2) || (score <= -0.45 && rating >= 4)) {
    return {
      label: 'uncertain',
      confidence: 0.35,
      method: 'rule-based',
      reason: `Text tone (${score > 0 ? 'positive' : 'negative'}) contradicts the ${rating}-star rating — review manually.`,
    };
  }

  const combined = 0.6 * score + 0.4 * prior;
  // 3-star reviews default to neutral; only clearly one-sided text moves them.
  const threshold = rating === 3 ? 0.35 : 0.2;
  const label = combined > threshold ? 'positive' : combined < -threshold ? 'negative' : 'neutral';
  const evidence = Math.min(hits, 4) / 4;
  const confidence = Math.min(0.92, 0.45 + 0.35 * Math.abs(combined) + 0.12 * evidence);
  return {
    label,
    confidence: Math.round(confidence * 100) / 100,
    method: 'rule-based',
    reason: `Text score ${score.toFixed(2)} from ${hits} sentiment cue${hits === 1 ? '' : 's'}, combined with ${rating} stars.`,
  };
}

const NEGATION_BEFORE = /(?:^|[^\p{L}'])(not|no|never|n't|isn't|wasn't|don't|doesn't|didn't|hardly|não|nao|pas|не|không|ko|chưa|nicht|kein\p{L}*)[^\p{L}]+(?:\p{L}+[^\p{L}]+){0,2}$/iu;

function matchesUnnegated(text: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  for (const m of text.matchAll(pattern)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 30), m.index);
    if (!NEGATION_BEFORE.test(before)) return true;
  }
  return false;
}

function matches(text: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

export function detectTags(text: string): ReviewTag[] {
  if (!text.trim()) return [];
  const lower = text.toLowerCase();
  const tags: ReviewTag[] = [];
  for (const [tag, pattern] of Object.entries(POSITIVE_TAG_PATTERNS) as Array<[PositiveTag, RegExp]>) {
    if (matchesUnnegated(lower, pattern)) tags.push(tag);
  }
  for (const [tag, pattern] of Object.entries(NEGATIVE_TAG_PATTERNS) as Array<[NegativeTag, RegExp]>) {
    if (matches(lower, pattern)) tags.push(tag);
  }
  return tags;
}

export function detectAspects(text: string): Aspect[] {
  if (!text.trim()) return [];
  const lower = text.toLowerCase();
  return (Object.entries(ASPECT_PATTERNS) as Array<[Aspect, RegExp]>)
    .filter(([, pattern]) => matches(lower, pattern))
    .map(([aspect]) => aspect);
}

/** Splits text into sentences for aspect-level polarity. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？])\s+|\n+|(?<=[,;])\s+(?=(?:but|however|pero|mas|mais|aber|но|nhưng)(?!\p{L}))/iu)
    .map((s) => s.trim())
    .filter(Boolean);
}
