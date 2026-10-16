import { randomBytes } from 'node:crypto';

export interface ServerConfig {
  host: string;
  port: number;
  accessToken: string;
  accessTokenGenerated: boolean;
  allowedOrigins: string[];
  rateLimitPerMinute: number;
  aiRateLimitPerHour: number;
  provider: {
    name: string | null;
    reviewsUrlTemplate: string | null;
    productUrlTemplate: string | null;
    apiKey: string | null;
    keyHeader: string;
    keyPrefix: string;
    extraHeaders: Record<string, string>;
    allowClientKey: boolean;
  };
  anthropic: {
    apiKey: string | null;
    model: string;
    allowClientKey: boolean;
  };
}

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

function validateTemplate(name: string, value: string | undefined): string | null {
  if (!value) return null;
  const sample = value.replace(/\{(productId|page)\}/g, '1');
  let url: URL;
  try {
    url = new URL(sample);
  } catch {
    throw new Error(`${name} is not a valid URL template.`);
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error(`${name} must use https (http is allowed for localhost only).`);
  }
  if (!value.includes('{productId}')) throw new Error(`${name} must contain the {productId} placeholder.`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  let accessToken = env.APP_ACCESS_TOKEN ?? '';
  let generated = false;
  if (!accessToken) {
    accessToken = randomBytes(24).toString('base64url');
    generated = true;
  } else if (accessToken.length < 16) {
    throw new Error('APP_ACCESS_TOKEN must be at least 16 characters.');
  }

  let extraHeaders: Record<string, string> = {};
  if (env.REVIEW_API_EXTRA_HEADERS) {
    try {
      const parsed = JSON.parse(env.REVIEW_API_EXTRA_HEADERS) as Record<string, unknown>;
      extraHeaders = Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    } catch {
      throw new Error('REVIEW_API_EXTRA_HEADERS must be a JSON object of header names to values.');
    }
  }

  return {
    host: env.HOST || '127.0.0.1',
    port: Number(env.PORT) || 8787,
    accessToken,
    accessTokenGenerated: generated,
    allowedOrigins: (env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    rateLimitPerMinute: Math.max(1, Number(env.RATE_LIMIT_PER_MINUTE) || 60),
    aiRateLimitPerHour: Math.max(1, Number(env.AI_RATE_LIMIT_PER_HOUR) || 20),
    provider: {
      name: env.REVIEW_PROVIDER_NAME || null,
      reviewsUrlTemplate: validateTemplate('REVIEW_API_URL_TEMPLATE', env.REVIEW_API_URL_TEMPLATE),
      productUrlTemplate: validateTemplate('PRODUCT_API_URL_TEMPLATE', env.PRODUCT_API_URL_TEMPLATE),
      apiKey: env.REVIEW_API_KEY || null,
      keyHeader: env.REVIEW_API_KEY_HEADER || 'x-api-key',
      keyPrefix: env.REVIEW_API_KEY_PREFIX || '',
      extraHeaders,
      allowClientKey: bool(env.ALLOW_CLIENT_PROVIDER_KEY, true),
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY || null,
      model: env.ANTHROPIC_MODEL || 'claude-opus-5-5',
      allowClientKey: bool(env.ALLOW_CLIENT_ANTHROPIC_KEY, true),
    },
  };
}
