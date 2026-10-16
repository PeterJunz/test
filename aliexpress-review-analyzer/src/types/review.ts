/** Star rating on AliExpress' 1–5 scale. */
export type StarRating = 1 | 2 | 3 | 4 | 5;

export type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'uncertain';

/** Where a dataset came from. `demo` data is synthetic and must always be labelled as such. */
export type DataOrigin = 'import' | 'api' | 'demo';

/** Product aspects a review may talk about. */
export type Aspect =
  | 'size'
  | 'material'
  | 'quality'
  | 'shipping'
  | 'durability'
  | 'packaging'
  | 'functionality'
  | 'description'
  | 'value'
  | 'usability';

export type PositiveTag =
  | 'works-well'
  | 'good-quality'
  | 'as-described'
  | 'good-packaging'
  | 'satisfied'
  | 'good-value'
  | 'on-time-delivery';

export type NegativeTag =
  | 'defective'
  | 'poor-quality'
  | 'not-as-described'
  | 'wrong-size'
  | 'missing-parts'
  | 'damaged-in-shipping'
  | 'slow-shipping'
  | 'not-working'
  | 'hard-to-use'
  | 'not-worth-it';

export type ReviewTag = PositiveTag | NegativeTag;

export interface SentimentResult {
  label: SentimentLabel;
  /** 0–1. How sure the classifier is. Rule-based scores are heuristics, not probabilities. */
  confidence: number;
  method: 'rule-based' | 'rating-only' | 'ai';
  /** Human-readable reason, shown in the review detail view. */
  reason: string;
}

/**
 * A review after normalisation. Deliberately contains no reviewer name, avatar or
 * account identifier: they are not needed for product research.
 */
export interface Review {
  /** Stable id derived from content (used for de-duplication). */
  id: string;
  datasetId: string;
  productId?: string;
  rating: StarRating;
  /** Review body. Empty string when the buyer left stars only. */
  text: string;
  /** ISO-8601 date (yyyy-mm-dd) or undefined when the source has no valid date. */
  date?: string;
  /** ISO 3166-1 alpha-2 code when recognised, otherwise the raw value upper-cased. */
  country?: string;
  variant?: string;
  images: string[];
  videos: string[];
  sourceUrl?: string;
  /** BCP-47 primary language code, `und` when unknown. */
  language: string;
  languageDetected: boolean;
  helpfulCount?: number;
  sentiment: SentimentResult;
  /** AI sentiment, only present after the user ran an AI analysis with consent. */
  aiSentiment?: SentimentResult;
  aspects: Aspect[];
  tags: ReviewTag[];
}

export interface Dataset {
  id: string;
  name: string;
  origin: DataOrigin;
  /** Free-text description of the source, e.g. file name or provider name. */
  sourceLabel: string;
  productId?: string;
  productUrl?: string;
  createdAt: string;
  reviews: Review[];
  /** Whether the source returned every review or only a subset (pagination limit, API cap...). */
  completeness: 'complete' | 'partial' | 'unknown';
  notes: string[];
  ai?: AiAnalysis;
}

export interface AiEvidencePoint {
  point: string;
  mentions: number;
  /** Review ids that support the point; verified against the dataset on receipt. */
  reviewIds: string[];
}

export interface AiAnalysis {
  createdAt: string;
  model: string;
  language: 'en' | 'vi';
  reviewCount: number;
  summary: string;
  commonPositives: AiEvidencePoint[];
  commonComplaints: AiEvidencePoint[];
  recurringDefects: AiEvidencePoint[];
  materialIssues: AiEvidencePoint[];
  packagingShippingIssues: AiEvidencePoint[];
  unmetExpectations: AiEvidencePoint[];
  highlyValued: AiEvidencePoint[];
  /** Ids returned by the model that did not exist in the dataset and were discarded. */
  discardedIds: number;
}
