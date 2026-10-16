/**
 * Accepts only absolute http(s) URLs (protocol-relative `//host/...` is upgraded to https).
 * Returns undefined for anything else (javascript:, data:, relative paths, garbage),
 * so the result is safe to put in `href` / `src`.
 */
export function toSafeHttpUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  let value = raw.trim();
  if (!value) return undefined;
  if (value.startsWith('//')) value = `https:${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    if (!url.hostname) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

const ALIEXPRESS_HOST = /(^|\.)aliexpress\.(com|us|ru)$|(^|\.)aliexpress\.[a-z]{2,3}(\.[a-z]{2})?$/i;

export interface ParsedProductInput {
  productId: string;
  canonicalUrl: string;
}

/**
 * Extracts an AliExpress product id from a product URL or a bare numeric id.
 * Supported:
 *   https://www.aliexpress.com/item/1005006123456789.html
 *   https://vi.aliexpress.com/item/1005006123456789.html?spm=...
 *   https://m.aliexpress.us/item/1005006123456789.html
 *   https://www.aliexpress.com/i/1005006123456789.html
 *   1005006123456789
 */
export function parseProductInput(input: string): ParsedProductInput | { error: string } {
  const value = input.trim();
  if (!value) return { error: 'Enter an AliExpress product URL or product ID.' };

  if (/^\d{6,20}$/.test(value)) {
    return { productId: value, canonicalUrl: `https://www.aliexpress.com/item/${value}.html` };
  }

  const safe = toSafeHttpUrl(value.includes('://') || value.startsWith('//') ? value : `https://${value}`);
  if (!safe) return { error: 'This is not a valid URL or numeric product ID.' };
  const url = new URL(safe);
  if (!ALIEXPRESS_HOST.test(url.hostname)) {
    return { error: `"${url.hostname}" is not an AliExpress domain.` };
  }
  const match = url.pathname.match(/\/(?:item|i)\/(?:[^/]*?)(\d{6,20})\.html/i);
  const fromQuery = url.searchParams.get('productId') ?? url.searchParams.get('itemId');
  const productId = match?.[1] ?? (fromQuery && /^\d{6,20}$/.test(fromQuery) ? fromQuery : undefined);
  if (!productId) return { error: 'Could not find a product ID in this URL (expected /item/<id>.html).' };
  return { productId, canonicalUrl: `https://www.aliexpress.com/item/${productId}.html` };
}
