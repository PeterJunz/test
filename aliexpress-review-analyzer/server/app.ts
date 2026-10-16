import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual, createHash } from 'node:crypto';
import { AiError, analyzeReviews, validateAiInput } from './ai.ts';
import type { ServerConfig } from './config.ts';
import { RateLimiter } from './rateLimit.ts';

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_UPSTREAM_BYTES = 10 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 25_000;

type Handler = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>;

function send(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extra,
  });
  res.end(payload);
}

function sameSecret(a: string, b: string): boolean {
  // Hash first so the comparison is constant-time regardless of length.
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Request body too large (max 1 MB).'), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body is not valid JSON.'), { status: 400 });
  }
}

function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

/** Fills {productId} and {page} into a template. Values are validated and URL-encoded. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? encodeURIComponent(values[key]) : m));
}

async function fetchUpstream(config: ServerConfig, url: string, clientKey: string | undefined): Promise<unknown> {
  const key = config.provider.apiKey ?? (config.provider.allowClientKey ? clientKey : undefined);
  if (!key) throw Object.assign(new Error('No provider API key configured.'), { status: 400 });
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'AliExpressReviewAnalyzerPro/1.0 (+self-hosted proxy)',
    ...config.provider.extraHeaders,
    [config.provider.keyHeader]: `${config.provider.keyPrefix}${key}`,
  };
  let res: Response;
  try {
    // redirect: 'manual' – never follow the upstream to a host we did not configure.
    res = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch (e) {
    const timeout = (e as Error).name === 'TimeoutError';
    throw Object.assign(new Error(timeout ? 'The data provider did not respond in time.' : 'Could not reach the data provider.'), { status: 502 });
  }
  if (res.status >= 300 && res.status < 400) throw Object.assign(new Error('The data provider tried to redirect; refusing to follow.'), { status: 502 });
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('The data provider rejected the API key or your plan does not include this endpoint.'), { status: 502 });
  if (res.status === 429) throw Object.assign(new Error('The data provider rate limit or quota was reached.'), { status: 429 });
  if (!res.ok) throw Object.assign(new Error(`The data provider returned HTTP ${res.status}.`), { status: 502 });
  const length = Number(res.headers.get('content-length'));
  if (length > MAX_UPSTREAM_BYTES) throw Object.assign(new Error('Provider response too large.'), { status: 502 });
  const text = await res.text();
  if (text.length > MAX_UPSTREAM_BYTES) throw Object.assign(new Error('Provider response too large.'), { status: 502 });
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('The data provider did not return JSON.'), { status: 502 });
  }
}

export function createApp(config: ServerConfig): Server {
  const limiter = new RateLimiter(config.rateLimitPerMinute, 60_000);
  const aiLimiter = new RateLimiter(config.aiRateLimitPerHour, 3_600_000);

  const productParams = (url: URL) => {
    const productId = url.searchParams.get('productId') ?? '';
    if (!/^\d{6,20}$/.test(productId)) throw Object.assign(new Error('productId must be 6–20 digits.'), { status: 400 });
    const pageRaw = url.searchParams.get('page') ?? '1';
    const page = Number(pageRaw);
    if (!Number.isInteger(page) || page < 1 || page > 500) throw Object.assign(new Error('page must be an integer from 1 to 500.'), { status: 400 });
    return { productId, page: String(page) };
  };

  const routes: Record<string, Handler> = {
    'GET /api/status': async (_req, res) => {
      const keySource = config.provider.apiKey ? 'server' : config.provider.allowClientKey && header(_req, 'x-provider-key') ? 'client' : 'none';
      send(res, 200, {
        ok: true,
        provider: {
          configured: Boolean(config.provider.reviewsUrlTemplate),
          name: config.provider.name,
          productInfo: Boolean(config.provider.productUrlTemplate),
          keySource,
        },
        ai: {
          configured: Boolean(config.anthropic.apiKey) || (config.anthropic.allowClientKey && Boolean(header(_req, 'x-anthropic-key'))),
          model: config.anthropic.model,
        },
      });
    },
    'GET /api/provider/reviews': async (req, res, url) => {
      if (!config.provider.reviewsUrlTemplate) return send(res, 501, { error: 'No review provider configured on the proxy (REVIEW_API_URL_TEMPLATE).' });
      const params = productParams(url);
      const data = await fetchUpstream(config, fillTemplate(config.provider.reviewsUrlTemplate, params), header(req, 'x-provider-key'));
      send(res, 200, { provider: config.provider.name, page: Number(params.page), data });
    },
    'GET /api/provider/product': async (req, res, url) => {
      if (!config.provider.productUrlTemplate) return send(res, 501, { error: 'This provider has no product-info endpoint configured.' });
      const params = productParams(url);
      const data = await fetchUpstream(config, fillTemplate(config.provider.productUrlTemplate, params), header(req, 'x-provider-key'));
      send(res, 200, { provider: config.provider.name, data });
    },
    'POST /api/ai/analyze': async (req, res) => {
      const key = config.anthropic.apiKey ?? (config.anthropic.allowClientKey ? header(req, 'x-anthropic-key') : undefined);
      if (!key) return send(res, 400, { error: 'AI is not configured: set ANTHROPIC_API_KEY on the proxy or enter a key in Settings.' });
      const retry = aiLimiter.check(clientKey(req));
      if (retry) return send(res, 429, { error: `AI rate limit reached. Retry in ${retry}s.` }, { 'Retry-After': String(retry) });
      const input = validateAiInput(await readJson(req));
      if ('error' in input) return send(res, 400, { error: input.error });
      try {
        const out = await analyzeReviews(key, config.anthropic.model, input.reviews, input.language);
        send(res, 200, out);
      } catch (e) {
        if (e instanceof AiError) return send(res, e.status, { error: e.message });
        throw e;
      }
    },
  };

  const clientKey = (req: IncomingMessage) => `${req.socket.remoteAddress ?? '?'}`;

  return createServer(async (req, res) => {
    const origin = header(req, 'origin');
    const corsHeaders: Record<string, string> = {};
    if (origin && config.allowedOrigins.includes(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Vary'] = 'Origin';
      corsHeaders['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, X-Provider-Key, X-Anthropic-Key';
      corsHeaders['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
      corsHeaders['Access-Control-Max-Age'] = '600';
    }
    for (const [k, v] of Object.entries(corsHeaders)) res.setHeader(k, v);

    try {
      if (origin && !corsHeaders['Access-Control-Allow-Origin']) return send(res, 403, { error: 'Origin not allowed. Add it to ALLOWED_ORIGINS.' });
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true });

      const route = routes[`${req.method} ${url.pathname}`];
      if (!route) return send(res, 404, { error: 'Not found.' });

      const auth = header(req, 'authorization') ?? '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!token || !sameSecret(token, config.accessToken)) return send(res, 401, { error: 'Missing or invalid access token.' });

      const retry = limiter.check(clientKey(req));
      if (retry) return send(res, 429, { error: `Rate limit reached. Retry in ${retry}s.` }, { 'Retry-After': String(retry) });

      await route(req, res, url);
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      if (status >= 500) console.error('[proxy]', (e as Error).message);
      if (!res.headersSent) send(res, status, { error: status >= 500 && !(e as { status?: number }).status ? 'Internal error.' : (e as Error).message });
    }
  });
}
