import type { SentimentLabel } from '../types/review';

export const SENTIMENT_LABEL: Record<SentimentLabel, string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
  uncertain: 'Uncertain',
};
