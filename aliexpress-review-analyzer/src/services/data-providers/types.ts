import type { Review } from '../../types/review';
import type { ImportReport } from '../review-normalizer/normalize';

export type ConnectionState = 'connected' | 'not-configured' | 'unreachable' | 'unauthorized' | 'unsupported' | 'local';

export type ConnectionCode =
  | 'missing-settings'
  | 'no-provider'
  | 'no-key'
  | 'connected'
  | 'unauthorized'
  | 'unreachable'
  | 'unsupported';

export interface ConnectionStatus {
  state: ConnectionState;
  /** Stable code the UI translates; `message` is the English fallback / technical detail. */
  code?: ConnectionCode;
  message: string;
  checkedAt: string;
  /** Capabilities confirmed by the source during validation (may be narrower than declared). */
  capabilities?: Partial<ProviderCapabilities>;
  providerName?: string;
}

/** What a source can actually deliver. The UI hides features a source cannot provide. */
export interface ProviderCapabilities {
  productInfo: boolean;
  reviews: boolean;
  reviewImages: boolean;
  reviewVideos: boolean;
  pagination: boolean;
  /** True only if the source documents that it returns every review (rare). */
  completeReviewSet: boolean;
}

export interface ProductInfo {
  productId: string;
  url: string;
  title?: string;
  averageRating?: number;
  totalReviews?: number;
  imageUrl?: string;
}

export interface PaginationInfo {
  page: number;
  pageSize?: number;
  totalPages?: number;
  totalReviews?: number;
  hasMore: boolean;
}

export interface FetchReviewsOptions {
  datasetId: string;
  signal?: AbortSignal;
}

export interface FetchReviewsResult {
  reviews: Review[];
  pagination: PaginationInfo;
  report: ImportReport;
}

/**
 * Contract every review data source implements. Optional methods are left out by
 * sources that do not support them — callers must check before calling, and the UI
 * must not show a button for a method that is missing.
 */
export interface ReviewProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly capabilities: ProviderCapabilities;
  validateConnection(signal?: AbortSignal): Promise<ConnectionStatus>;
  fetchProductInfo?(productId: string, signal?: AbortSignal): Promise<ProductInfo>;
  fetchReviews?(productId: string, page: number, options: FetchReviewsOptions): Promise<FetchReviewsResult>;
  fetchReviewImages?(productId: string, reviewId: string, signal?: AbortSignal): Promise<string[]>;
  getPaginationInfo?(): PaginationInfo | undefined;
}

export class ProviderError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}
