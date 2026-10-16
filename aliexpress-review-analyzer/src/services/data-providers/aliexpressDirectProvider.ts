import type { FieldMapping } from '../review-normalizer/fields';
import { normalizeRows } from '../review-normalizer/normalize';
import { flattenRecord } from '../review-normalizer/parse';
import {
  ProviderError,
  type ConnectionStatus,
  type FetchReviewsOptions,
  type FetchReviewsResult,
  type PaginationInfo,
  type ProviderCapabilities,
  type ReviewProvider,
} from './types';

/**
 * Reads the public review feed that AliExpress product pages themselves load
 * (feedback.aliexpress.com/pc/searchEvaluation.do). No login, no API key.
 *
 * That endpoint sends no CORS headers, so a normal web page cannot call it. It works
 * from the bundled browser extension, which has host permission for that one domain.
 *
 * Ground rules, deliberately conservative:
 *  - one request at a time, at most one per second;
 *  - never solves, skips or works around a CAPTCHA/verification page — it stops and
 *    tells the user, who can open aliexpress.com and verify as a normal visitor;
 *  - reviewer name, avatar and gender are dropped before anything is stored.
 * AliExpress' terms may restrict automated collection; the UI says so and the user decides.
 */
export const AE_FEEDBACK_ENDPOINT = 'https://feedback.aliexpress.com/pc/searchEvaluation.do';
export const AE_PAGE_SIZE = 50;
const MIN_INTERVAL_MS = 1000;
const TIMEOUT_MS = 30_000;

export const AE_LANGUAGES = ['en_US', 'vi_VN', 'es_ES', 'fr_FR', 'de_DE', 'pt_BR', 'ru_RU'] as const;
export type AeLanguage = (typeof AE_LANGUAGES)[number];

/** Paths inside each flattened `evaViewList[]` entry. */
export const AE_MAPPING: FieldMapping = {
  review_id: 'evaluationIdStr',
  rating: 'buyerEval',
  review_text: 'text',
  review_date: 'evalDate',
  reviewer_country: 'buyerCountry',
  product_variant: 'skuInfo',
  review_images: 'images',
  review_video: 'videos',
  helpful_count: 'upVoteCount',
};

export interface AeStarStatistic {
  total: number;
  average: number;
  stars: Record<1 | 2 | 3 | 4 | 5, number>;
}

/** True when running as the browser extension (the only context that may call the feed). */
export function isExtensionContext(): boolean {
  const g = globalThis as { chrome?: { runtime?: { id?: string } }; browser?: { runtime?: { id?: string } } };
  return Boolean(g.chrome?.runtime?.id || g.browser?.runtime?.id);
}

interface RawEntry {
  evaluationIdStr?: string;
  evaluationId?: number;
  buyerEval?: number;
  buyerFeedback?: string;
  buyerTranslationFeedback?: string;
  buyerAddFbContent?: string;
  evalDate?: string;
  buyerCountry?: string;
  skuInfo?: string;
  images?: string[];
  upVoteCount?: number;
  [key: string]: unknown;
}

interface RawBody {
  data?: {
    currentPage?: number;
    pageSize?: number;
    totalNum?: number;
    totalPage?: number;
    evaViewList?: RawEntry[];
    productEvaluationStatistic?: Record<string, number>;
  };
}

/** Collects video URLs from whatever video fields an entry carries (rare, optional). */
function videoUrls(e: RawEntry): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(e)) {
    if (!/video/i.test(k)) continue;
    if (typeof v === 'string' && /^https?:\/\//.test(v)) out.push(v);
    if (Array.isArray(v)) for (const x of v) if (typeof x === 'string' && /^https?:\/\//.test(x)) out.push(x);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const x of Object.values(v)) if (typeof x === 'string' && /^https?:\/\/.*\.(mp4|m3u8|webm|mov)/i.test(x)) out.push(x);
    }
  }
  return out;
}

/** Converts a feed entry into a plain row; identity fields never leave this function. */
export function entryToRow(e: RawEntry): Record<string, unknown> {
  const main = (e.buyerTranslationFeedback || e.buyerFeedback || '').trim();
  const follow = typeof e.buyerAddFbContent === 'string' ? e.buyerAddFbContent.trim() : '';
  return flattenRecord({
    evaluationIdStr: e.evaluationIdStr ?? (e.evaluationId !== undefined ? String(e.evaluationId) : undefined),
    buyerEval: e.buyerEval,
    text: follow ? `${main}\n\n[+] ${follow}` : main,
    evalDate: e.evalDate,
    buyerCountry: e.buyerCountry,
    skuInfo: e.skuInfo,
    images: Array.isArray(e.images) ? e.images : [],
    videos: videoUrls(e),
    upVoteCount: e.upVoteCount,
  });
}

export function parseStatistic(stat: Record<string, number> | undefined): AeStarStatistic | undefined {
  if (!stat || typeof stat.totalNum !== 'number') return undefined;
  return {
    total: stat.totalNum,
    average: stat.evarageStar,
    stars: { 1: stat.oneStarNum ?? 0, 2: stat.twoStarNum ?? 0, 3: stat.threeStarNum ?? 0, 4: stat.fourStarNum ?? 0, 5: stat.fiveStarNum ?? 0 },
  };
}

export class AliExpressBlockedError extends ProviderError {}

export class AliExpressDirectProvider implements ReviewProvider {
  readonly id = 'aliexpress-direct';
  readonly name = 'AliExpress';
  readonly description = 'Reads the public review feed of AliExpress product pages, through the browser extension.';
  readonly capabilities: ProviderCapabilities = {
    productInfo: false,
    reviews: true,
    reviewImages: true,
    reviewVideos: true,
    pagination: true,
    completeReviewSet: true,
  };
  /** Star counts AliExpress reports for the product, from the last response. */
  statistic?: AeStarStatistic;
  private lastPagination?: PaginationInfo;
  private lastCall = 0;
  private readonly language: AeLanguage;
  private readonly fetchImpl: typeof fetch;
  private readonly inExtension: () => boolean;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    language: AeLanguage = 'en_US',
    deps: { fetchImpl?: typeof fetch; inExtension?: () => boolean; sleep?: (ms: number) => Promise<void> } = {},
  ) {
    this.language = language;
    this.fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args));
    this.inExtension = deps.inExtension ?? isExtensionContext;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async validateConnection(): Promise<ConnectionStatus> {
    const checkedAt = new Date().toISOString();
    if (!this.inExtension()) {
      return { state: 'not-configured', code: 'ae-needs-extension', message: 'Direct AliExpress fetching only works in the browser-extension version of the app.', checkedAt };
    }
    return { state: 'connected', code: 'ae-connected', message: 'Ready to read reviews directly from AliExpress.', checkedAt, providerName: this.name };
  }

  async fetchReviews(productId: string, page: number, options: FetchReviewsOptions): Promise<FetchReviewsResult> {
    if (!this.inExtension()) throw new ProviderError('Direct AliExpress fetching only works in the browser-extension version of the app.', 0);
    const wait = this.lastCall + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await this.sleep(wait);
    this.lastCall = Date.now();

    const params = new URLSearchParams({
      productId,
      page: String(page),
      pageSize: String(AE_PAGE_SIZE),
      filter: 'all',
      sort: 'complex_default',
      lang: this.language,
    });
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetchImpl(`${AE_FEEDBACK_ENDPOINT}?${params}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError' && options.signal?.aborted) throw e;
      throw new ProviderError('Could not reach feedback.aliexpress.com (check your internet connection).', 0);
    }
    const raw = await res.text();
    let body: RawBody;
    try {
      body = JSON.parse(raw) as RawBody;
    } catch {
      // An HTML answer is AliExpress' verification/slider page. Never try to get past it.
      if (/captcha|punish|x5sec|nocaptcha|_____tmd_____|verify/i.test(raw) || res.status === 403 || res.status === 429) {
        throw new AliExpressBlockedError('AliExpress asked for verification (CAPTCHA). Open aliexpress.com in a tab, complete it as a normal visitor, wait a minute and try again.', res.status);
      }
      throw new ProviderError(`AliExpress returned an unexpected response (HTTP ${res.status}).`, res.status);
    }
    if (!res.ok) throw new ProviderError(`AliExpress returned HTTP ${res.status}.`, res.status);
    const data = body.data;
    if (!data || !Array.isArray(data.evaViewList)) {
      throw new ProviderError('AliExpress returned no review list — the product id may be wrong, or the feed format changed.', res.status);
    }

    const rows = data.evaViewList.map(entryToRow);
    const { reviews, report } = normalizeRows(rows, AE_MAPPING, {
      datasetId: options.datasetId,
      origin: 'api',
      productId,
      ratingScale: '100',
      dateOrder: 'DMY',
    });
    this.statistic = parseStatistic(data.productEvaluationStatistic) ?? this.statistic;
    const totalPages = typeof data.totalPage === 'number' ? data.totalPage : undefined;
    const current = typeof data.currentPage === 'number' ? data.currentPage : page;
    this.lastPagination = {
      page: current,
      pageSize: data.pageSize ?? AE_PAGE_SIZE,
      totalReviews: typeof data.totalNum === 'number' ? data.totalNum : undefined,
      totalPages,
      hasMore: rows.length > 0 && (totalPages === undefined ? rows.length >= AE_PAGE_SIZE : current < totalPages),
    };
    return { reviews, report, pagination: this.lastPagination, creditsUsed: 0 };
  }

  getPaginationInfo(): PaginationInfo | undefined {
    return this.lastPagination;
  }
}
