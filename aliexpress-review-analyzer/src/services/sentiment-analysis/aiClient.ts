import type { AiAnalysis, AiEvidencePoint, Review, SentimentLabel, SentimentResult } from '../../types/review';

export const AI_MAX_REVIEWS = 300;
export const AI_MAX_CHARS = 100_000;

export interface AiRequestConfig {
  baseUrl: string;
  accessToken: string;
  anthropicKey?: string;
  language: 'en' | 'vi';
}

/** Exactly what leaves the browser: no country, no URLs, no images — only what the analysis needs. */
export interface AiReviewPayload {
  id: string;
  rating: number;
  text: string;
  variant?: string;
}

export function selectReviewsForAi(reviews: Review[]): { payload: AiReviewPayload[]; skippedNoText: number; truncated: boolean } {
  const withText = reviews.filter((r) => r.text.trim());
  const payload: AiReviewPayload[] = [];
  let chars = 0;
  let truncated = false;
  for (const r of withText) {
    const text = r.text.slice(0, 1500);
    if (payload.length >= AI_MAX_REVIEWS || chars + text.length > AI_MAX_CHARS) {
      truncated = true;
      break;
    }
    chars += text.length;
    payload.push({ id: r.id, rating: r.rating, text, ...(r.variant ? { variant: r.variant.slice(0, 120) } : {}) });
  }
  return { payload, skippedNoText: reviews.length - withText.length, truncated };
}

interface RawPoint { point?: unknown; mentions?: unknown; review_ids?: unknown }
interface RawResponse {
  model?: unknown;
  result?: {
    summary?: unknown;
    common_positives?: RawPoint[];
    common_complaints?: RawPoint[];
    recurring_defects?: RawPoint[];
    material_issues?: RawPoint[];
    packaging_shipping_issues?: RawPoint[];
    unmet_expectations?: RawPoint[];
    highly_valued?: RawPoint[];
    sentiments?: Array<{ id?: unknown; label?: unknown; confidence?: unknown; reason?: unknown }>;
  };
  error?: unknown;
}

const LABELS: SentimentLabel[] = ['positive', 'neutral', 'negative', 'uncertain'];

/**
 * Validates the model output against the reviews that were actually sent: unknown ids
 * are discarded (and counted) so every cited review exists in the dataset.
 */
export function parseAiResponse(raw: RawResponse, sent: AiReviewPayload[], language: 'en' | 'vi'): { analysis: AiAnalysis; sentiments: Map<string, SentimentResult> } {
  const r = raw.result;
  if (!r || typeof r.summary !== 'string') throw new Error('The AI response was not in the expected format.');
  const valid = new Set(sent.map((s) => s.id));
  let discarded = 0;
  const points = (list: RawPoint[] | undefined): AiEvidencePoint[] =>
    (Array.isArray(list) ? list : [])
      .filter((p) => typeof p?.point === 'string' && p.point.trim())
      .map((p) => {
        const ids = (Array.isArray(p.review_ids) ? p.review_ids : []).filter((id): id is string => typeof id === 'string');
        const kept = [...new Set(ids.filter((id) => valid.has(id)))];
        discarded += ids.length - ids.filter((id) => valid.has(id)).length;
        return { point: String(p.point).slice(0, 300), mentions: kept.length, reviewIds: kept };
      })
      // A point with no verifiable supporting review is not shown.
      .filter((p) => p.reviewIds.length > 0)
      .slice(0, 10);

  const sentiments = new Map<string, SentimentResult>();
  for (const s of Array.isArray(r.sentiments) ? r.sentiments : []) {
    if (typeof s?.id !== 'string' || !valid.has(s.id)) continue;
    const label = LABELS.includes(s.label as SentimentLabel) ? (s.label as SentimentLabel) : 'uncertain';
    const confidence = typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0.5;
    sentiments.set(s.id, { label, confidence, method: 'ai', reason: typeof s.reason === 'string' ? s.reason.slice(0, 200) : 'AI classification' });
  }

  return {
    sentiments,
    analysis: {
      createdAt: new Date().toISOString(),
      model: typeof raw.model === 'string' ? raw.model : 'unknown',
      language,
      reviewCount: sent.length,
      summary: r.summary.slice(0, 4000),
      commonPositives: points(r.common_positives),
      commonComplaints: points(r.common_complaints),
      recurringDefects: points(r.recurring_defects),
      materialIssues: points(r.material_issues),
      packagingShippingIssues: points(r.packaging_shipping_issues),
      unmetExpectations: points(r.unmet_expectations),
      highlyValued: points(r.highly_valued),
      discardedIds: discarded,
    },
  };
}

export async function requestAiAnalysis(config: AiRequestConfig, payload: AiReviewPayload[], signal?: AbortSignal) {
  if (!payload.length) throw new Error('There are no reviews with text in the current selection.');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.accessToken}` };
  if (config.anthropicKey) headers['X-Anthropic-Key'] = config.anthropicKey;
  let res: Response;
  try {
    res = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/api/ai/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ language: config.language, reviews: payload }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(300_000)]) : AbortSignal.timeout(300_000),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error(`Cannot reach the proxy at ${config.baseUrl}.`);
  }
  const body = (await res.json().catch(() => ({}))) as RawResponse;
  if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `AI request failed (HTTP ${res.status}).`);
  return parseAiResponse(body, payload, config.language);
}
