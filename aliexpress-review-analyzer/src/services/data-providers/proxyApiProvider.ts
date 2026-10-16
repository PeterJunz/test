import { autoDetectMapping, type FieldMapping } from '../review-normalizer/fields';
import { normalizeRows, type NormalizeOptions } from '../review-normalizer/normalize';
import { findRecordArray, flattenRecord } from '../review-normalizer/parse';
import type { DateOrder } from '../../utils/date';
import { getPath } from '../../utils/objectPath';
import {
  ProviderError,
  type ConnectionStatus,
  type FetchReviewsOptions,
  type FetchReviewsResult,
  type PaginationInfo,
  type ProductInfo,
  type ProviderCapabilities,
  type ReviewProvider,
} from './types';

export interface ProxyProviderConfig {
  /** Base URL of the bundled proxy server, e.g. http://localhost:8787 */
  baseUrl: string;
  /** Shared secret configured as APP_ACCESS_TOKEN on the proxy. */
  accessToken: string;
  /** Optional provider key forwarded to the proxy when the server has none configured. */
  providerKey?: string;
  /** Dot path to the review array in the provider's response; empty = auto-detect. */
  reviewsPath?: string;
  /** Dot path to the total review count, if the provider returns one. */
  totalPath?: string;
  /** Column mapping for the provider's review objects; empty = auto-detect. */
  mapping?: FieldMapping;
  ratingScale?: NormalizeOptions['ratingScale'];
  dateOrder?: DateOrder;
}

interface ProxyStatus {
  ok: boolean;
  provider: { configured: boolean; name: string | null; productInfo: boolean; keySource: 'server' | 'client' | 'none' };
  ai: { configured: boolean; model: string | null };
}

const TIMEOUT_MS = 30_000;

/**
 * Talks to a licensed third-party review API through the local proxy (server/), which
 * keeps the provider key out of the browser, rate-limits calls and fixes the upstream
 * host so the browser cannot use it as an open proxy.
 */
export class ProxyApiProvider implements ReviewProvider {
  readonly id = 'proxy-api';
  readonly name = 'Licensed data provider (via local proxy)';
  readonly description = 'Fetches reviews from a third-party API you have a plan with. The provider is configured on the proxy server.';
  capabilities: ProviderCapabilities = {
    productInfo: false,
    reviews: true,
    reviewImages: true,
    reviewVideos: true,
    pagination: true,
    completeReviewSet: false,
  };
  private lastPagination?: PaginationInfo;
  private readonly config: ProxyProviderConfig;

  constructor(config: ProxyProviderConfig) {
    this.config = config;
  }

  private url(path: string, params?: Record<string, string>): string {
    const base = this.config.baseUrl.replace(/\/+$/, '');
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return `${base}${path}${qs}`;
  }

  private async request<T>(path: string, init: RequestInit & { params?: Record<string, string> } = {}): Promise<T> {
    if (!this.config.baseUrl) throw new ProviderError('Proxy URL is not configured.');
    const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${this.config.accessToken}` };
    if (this.config.providerKey) headers['X-Provider-Key'] = this.config.providerKey;
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    let res: Response;
    try {
      res = await fetch(this.url(path, init.params), { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) }, signal });
    } catch (e) {
      if ((e as Error).name === 'AbortError' && init.signal?.aborted) throw e;
      throw new ProviderError(`Cannot reach the proxy at ${this.config.baseUrl}. Is "npm run server" running?`);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = typeof body?.error === 'string' ? body.error : `Proxy returned HTTP ${res.status}`;
      throw new ProviderError(message, res.status);
    }
    return body as T;
  }

  async validateConnection(signal?: AbortSignal): Promise<ConnectionStatus> {
    const checkedAt = new Date().toISOString();
    if (!this.config.baseUrl || !this.config.accessToken) {
      return { state: 'not-configured', message: 'Set the proxy URL and access token in Settings → Data sources.', checkedAt };
    }
    try {
      const status = await this.request<ProxyStatus>('/api/status', { signal });
      if (!status.provider.configured) {
        return { state: 'not-configured', message: 'Proxy is running, but no review provider is configured (REVIEW_API_URL_TEMPLATE).', checkedAt };
      }
      if (status.provider.keySource === 'none') {
        return { state: 'not-configured', message: 'Proxy has a provider URL but no API key (set REVIEW_API_KEY or enter one in Settings).', checkedAt };
      }
      this.capabilities = { ...this.capabilities, productInfo: status.provider.productInfo };
      return {
        state: 'connected',
        message: `Proxy connected — provider: ${status.provider.name ?? 'unnamed'}. Connection to the provider itself is verified on the first request.`,
        checkedAt,
        providerName: status.provider.name ?? undefined,
        capabilities: { productInfo: status.provider.productInfo },
      };
    } catch (e) {
      if (e instanceof ProviderError && (e.status === 401 || e.status === 403)) {
        return { state: 'unauthorized', message: 'The proxy rejected the access token.', checkedAt };
      }
      if ((e as Error).name === 'AbortError') throw e;
      return { state: 'unreachable', message: (e as Error).message, checkedAt };
    }
  }

  async fetchProductInfo(productId: string, signal?: AbortSignal): Promise<ProductInfo> {
    const body = await this.request<{ data: unknown }>('/api/provider/product', { params: { productId }, signal });
    const d = body.data as Record<string, unknown>;
    const pick = (...keys: string[]) => keys.map((k) => getPath(d, k)).find((v) => v !== undefined && v !== null);
    const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() && !isNaN(Number(v)) ? Number(v) : undefined);
    return {
      productId,
      url: `https://www.aliexpress.com/item/${productId}.html`,
      title: String(pick('title', 'subject', 'name', 'data.title', 'result.title') ?? '') || undefined,
      averageRating: num(pick('rating', 'averageRating', 'evaluation.rating', 'data.rating')),
      totalReviews: num(pick('totalReviews', 'reviewCount', 'reviews', 'data.reviewCount')),
    };
  }

  async fetchReviews(productId: string, page: number, options: FetchReviewsOptions): Promise<FetchReviewsResult> {
    const body = await this.request<{ data: unknown }>('/api/provider/reviews', {
      params: { productId, page: String(page) },
      signal: options.signal,
    });
    const records = this.config.reviewsPath ? getPath(body.data, this.config.reviewsPath) : findRecordArray(body.data);
    if (!Array.isArray(records)) {
      throw new ProviderError(
        this.config.reviewsPath
          ? `No array found at "${this.config.reviewsPath}" in the provider response.`
          : 'Could not find a list of reviews in the provider response. Set the "reviews path" in Settings.',
      );
    }
    const rows = records.filter((r) => r && typeof r === 'object').map((r) => flattenRecord(r as Record<string, unknown>));
    const mapping = this.config.mapping && Object.keys(this.config.mapping).length ? this.config.mapping : autoDetectMapping(Object.keys(rows[0] ?? {}));
    const { reviews, report } = normalizeRows(rows, mapping, {
      datasetId: options.datasetId,
      origin: 'api',
      productId,
      ratingScale: this.config.ratingScale,
      dateOrder: this.config.dateOrder,
    });
    const totalRaw = this.config.totalPath ? Number(getPath(body.data, this.config.totalPath)) : NaN;
    const totalReviews = Number.isFinite(totalRaw) ? totalRaw : undefined;
    const pageSize = rows.length || undefined;
    const totalPages = totalReviews && pageSize ? Math.ceil(totalReviews / pageSize) : undefined;
    this.lastPagination = {
      page,
      pageSize,
      totalReviews,
      totalPages,
      hasMore: rows.length > 0 && (totalPages === undefined || page < totalPages),
    };
    return { reviews, pagination: this.lastPagination, report };
  }

  getPaginationInfo(): PaginationInfo | undefined {
    return this.lastPagination;
  }
}
