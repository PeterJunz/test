import type { ConnectionStatus, ProviderCapabilities, ReviewProvider } from './types';

/**
 * AliExpress Open Platform (openservice.aliexpress.com).
 *
 * The Affiliate and Dropshipping API families expose product details, prices, logistics
 * and orders to approved developer accounts. At the time of writing we could not verify
 * a documented, generally available endpoint that returns buyer reviews/feedback, so
 * this adapter deliberately implements no fetch methods. If your approved app has a
 * feedback API in its permission list, implement `fetchReviews` here against that
 * documented endpoint (server-side, through the proxy, because it needs an app secret
 * and request signing).
 */
export class AliExpressOpenPlatformProvider implements ReviewProvider {
  readonly id = 'aliexpress-open-platform';
  readonly name = 'AliExpress Open Platform (official)';
  readonly description =
    'Official API for approved developer accounts. No verified public reviews endpoint — reviews cannot be fetched through this adapter.';
  readonly capabilities: ProviderCapabilities = {
    productInfo: false,
    reviews: false,
    reviewImages: false,
    reviewVideos: false,
    pagination: false,
    completeReviewSet: false,
  };

  async validateConnection(): Promise<ConnectionStatus> {
    return {
      state: 'unsupported',
      message:
        'Not available: AliExpress does not document a public review API for third-party apps. Use a licensed data provider through the proxy, or import an export file.',
      checkedAt: new Date().toISOString(),
    };
  }
}
