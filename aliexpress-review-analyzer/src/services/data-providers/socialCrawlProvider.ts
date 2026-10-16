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
 * SocialCrawl AliExpress reviews API (third-party, paid per page; 100 free credits on signup).
 * Docs: https://www.socialcrawl.dev/platforms/aliexpress/reviews
 *
 * The API sends `Access-Control-Allow-Origin: *`, so the browser — including the standalone
 * HTML opened from disk — calls it directly with the user's own key. 20 reviews per page,
 * 5 credits per non-empty page.
 */
export const SOCIALCRAWL_ENDPOINT = 'https://www.socialcrawl.dev/v1/aliexpress/reviews';
export const SOCIALCRAWL_SIGNUP_URL = 'https://www.socialcrawl.dev';
export const SOCIALCRAWL_PAGE_SIZE = 20;
export const SOCIALCRAWL_CREDITS_PER_PAGE = 5;
/** Languages the API documents as validated for the `language` (translation) parameter. */
export const SOCIALCRAWL_LANGUAGES = ['EN', 'VI', 'ES', 'FR', 'DE', 'PT', 'RU', 'IT', 'TR', 'PL', 'NL', 'KO', 'JA', 'AR', 'HE', 'TH', 'ID'] as const;
export type SocialCrawlLanguage = (typeof SOCIALCRAWL_LANGUAGES)[number];

/** Field paths inside each flattened `items[].review` object. The reviewer's name is deliberately not mapped. */
export const SOCIALCRAWL_MAPPING: FieldMapping = {
  review_id: 'id',
  rating: 'rating.value',
  review_text: 'text',
  review_date: 'published_at',
  reviewer_country: 'author.location',
  review_images: 'images',
  helpful_count: 'helpful_votes',
  source_url: 'url',
};

export interface SocialCrawlConfig {
  apiKey: string;
  /** Language the review text is returned (translated) in. */
  language: SocialCrawlLanguage;
  sort: 'default' | 'newest';
}

interface ApiErrorBody {
  success?: false;
  error?: { type?: string; message?: string; status?: number };
}

interface ApiReviewsBody {
  success?: boolean;
  data?: { items?: Array<{ review?: Record<string, unknown> }>; total?: number; next_cursor?: string | null };
  pagination?: { has_more?: boolean; page_size?: number; next_cursor?: string | null };
  credits_used?: number;
  credits_remaining?: number | null;
}

const TIMEOUT_MS = 45_000;

export class SocialCrawlProvider implements ReviewProvider {
  readonly id = 'socialcrawl';
  readonly name = 'SocialCrawl';
  readonly description = 'Third-party AliExpress reviews API, called directly from the browser with your own API key.';
  readonly capabilities: ProviderCapabilities = {
    productInfo: false,
    reviews: true,
    reviewImages: true,
    reviewVideos: false,
    pagination: true,
    completeReviewSet: false,
  };
  private lastPagination?: PaginationInfo;
  private readonly config: SocialCrawlConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SocialCrawlConfig, fetchImpl: typeof fetch = (...args) => fetch(...args)) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  private async call(params: Record<string, string>, signal?: AbortSignal): Promise<ApiReviewsBody> {
    if (!this.config.apiKey) throw new ProviderError('No SocialCrawl API key set.', 0);
    const url = `${SOCIALCRAWL_ENDPOINT}?${new URLSearchParams(params).toString()}`;
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        headers: { 'x-api-key': this.config.apiKey, Accept: 'application/json' },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        referrerPolicy: 'no-referrer',
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError' && signal?.aborted) throw e;
      throw new ProviderError('Could not reach api.socialcrawl.dev (check your internet connection).', 0);
    }
    const body = (await res.json().catch(() => ({}))) as ApiReviewsBody & ApiErrorBody;
    if (!res.ok || body.success === false) {
      const type = body.error?.type ?? '';
      const detail = body.error?.message ?? `HTTP ${res.status}`;
      throw new ProviderError(`SocialCrawl: ${detail}${type ? ` (${type})` : ''}`, res.status);
    }
    return body;
  }

  async validateConnection(signal?: AbortSignal): Promise<ConnectionStatus> {
    const checkedAt = new Date().toISOString();
    if (!this.config.apiKey) {
      return { state: 'not-configured', code: 'sc-missing-key', message: 'Enter your SocialCrawl API key in Settings.', checkedAt };
    }
    try {
      // dry_run=1 is documented as a free cost preview: it checks the key without spending credits.
      await this.call({ product_id: '1005006079931969', dry_run: '1' }, signal);
      return { state: 'connected', code: 'sc-connected', message: 'SocialCrawl API key accepted.', checkedAt, providerName: this.name };
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      const status = (e as ProviderError).status;
      if (status === 401 || status === 403) {
        return { state: 'unauthorized', code: 'sc-invalid-key', message: (e as Error).message, checkedAt };
      }
      return { state: 'unreachable', code: 'sc-error', message: (e as Error).message, checkedAt };
    }
  }

  async fetchReviews(productId: string, page: number, options: FetchReviewsOptions): Promise<FetchReviewsResult> {
    const body = await this.call(
      {
        product_id: productId,
        page: String(page),
        filter: 'all',
        sort_by: this.config.sort,
        language: this.config.language,
        // Labels are not needed (the app has its own analysis) and paid labels would cost extra.
        label: 'none',
        judgments: 'off',
      },
      options.signal,
    );
    const items = Array.isArray(body.data?.items) ? body.data.items : [];
    const rows = items
      .map((item) => item?.review)
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
      .map((r) => {
        const { author, ...rest } = r as { author?: Record<string, unknown> };
        // Keep only the reviewer's location; name, avatar and profile URL are dropped here.
        return flattenRecord({ ...rest, author: { location: author?.location ?? null } });
      });
    const { reviews, report } = normalizeRows(rows, SOCIALCRAWL_MAPPING, {
      datasetId: options.datasetId,
      origin: 'api',
      productId,
      ratingScale: '5',
    });
    // The text is a copy in the requested language; record that so language filters stay truthful.
    for (const r of reviews) {
      r.language = this.config.language.toLowerCase();
      r.languageDetected = false;
    }
    const total = typeof body.data?.total === 'number' ? body.data.total : undefined;
    const pageSize = body.pagination?.page_size ?? SOCIALCRAWL_PAGE_SIZE;
    const totalPages = total !== undefined ? Math.ceil(total / pageSize) : undefined;
    this.lastPagination = {
      page,
      pageSize,
      totalReviews: total,
      totalPages,
      hasMore: Boolean(body.pagination?.has_more) && rows.length > 0,
    };
    return {
      reviews,
      report,
      pagination: this.lastPagination,
      creditsUsed: typeof body.credits_used === 'number' ? body.credits_used : undefined,
      creditsRemaining: typeof body.credits_remaining === 'number' ? body.credits_remaining : undefined,
    };
  }

  getPaginationInfo(): PaginationInfo | undefined {
    return this.lastPagination;
  }
}

/** Estimated credits to fetch `reviews` reviews (only non-empty pages are billed). */
export function estimateCredits(reviews: number): { pages: number; credits: number } {
  const pages = Math.max(1, Math.ceil(reviews / SOCIALCRAWL_PAGE_SIZE));
  return { pages, credits: pages * SOCIALCRAWL_CREDITS_PER_PAGE };
}
