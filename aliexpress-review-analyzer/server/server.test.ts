import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp, fillTemplate } from './app.ts';
import { loadConfig } from './config.ts';
import { validateAiInput } from './ai.ts';
import { RateLimiter } from './rateLimit.ts';

const TOKEN = 'test-token-0123456789abcdef';
let server: Server;
let base: string;

beforeAll(async () => {
  const config = loadConfig({ APP_ACCESS_TOKEN: TOKEN, RATE_LIMIT_PER_MINUTE: '5', ALLOWED_ORIGINS: 'http://localhost:5173' });
  server = createApp(config);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const auth = { Authorization: `Bearer ${TOKEN}` };

describe('proxy server', () => {
  it('serves an unauthenticated health check', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
  });

  it('requires the access token', async () => {
    expect((await fetch(`${base}/api/status`)).status).toBe(401);
    expect((await fetch(`${base}/api/status`, { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
    const ok = await fetch(`${base}/api/status`, { headers: auth });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { provider: { configured: boolean } }).provider.configured).toBe(false);
  });

  it('rejects disallowed origins and answers CORS preflight for allowed ones', async () => {
    expect((await fetch(`${base}/api/status`, { headers: { ...auth, Origin: 'https://evil.example' } })).status).toBe(403);
    const pre = await fetch(`${base}/api/status`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('reports an unconfigured provider honestly (no fake data)', async () => {
    const res = await fetch(`${base}/api/provider/reviews?productId=1005006123456789&page=1`, { headers: auth });
    expect(res.status).toBe(501);
  });

  it('rate-limits', async () => {
    let last = 0;
    for (let i = 0; i < 8; i++) last = (await fetch(`${base}/api/status`, { headers: auth })).status;
    expect(last).toBe(429);
  });
});

describe('config', () => {
  it('rejects non-https upstream templates and missing placeholders', () => {
    expect(() => loadConfig({ REVIEW_API_URL_TEMPLATE: 'http://api.example.com/r?id={productId}' })).toThrow(/https/);
    expect(() => loadConfig({ REVIEW_API_URL_TEMPLATE: 'https://api.example.com/r' })).toThrow(/productId/);
    expect(() => loadConfig({ APP_ACCESS_TOKEN: 'short' })).toThrow();
  });
  it('generates a token when none is set', () => {
    const c = loadConfig({});
    expect(c.accessTokenGenerated).toBe(true);
    expect(c.accessToken.length).toBeGreaterThanOrEqual(24);
  });
});

describe('helpers', () => {
  it('URL-encodes template values', () => {
    expect(fillTemplate('https://a.com/r?id={productId}&p={page}&x={other}', { productId: '1 2', page: '3' })).toBe('https://a.com/r?id=1%202&p=3&x={other}');
  });
  it('validates AI input', () => {
    expect('error' in validateAiInput({ reviews: [] })).toBe(true);
    expect('error' in validateAiInput({ reviews: [{ id: 'a b', rating: 5, text: 'x' }] })).toBe(true);
    expect('error' in validateAiInput({ reviews: [{ id: 'a', rating: 9, text: 'x' }] })).toBe(true);
    const ok = validateAiInput({ language: 'vi', reviews: [{ id: 'a', rating: 5, text: 'x'.repeat(5000) }] });
    expect('reviews' in ok && ok.reviews[0].text.length).toBe(1500);
  });
  it('rate limiter resets after the window', () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.check('k', 0)).toBe(0);
    expect(rl.check('k', 10)).toBeGreaterThan(0);
    expect(rl.check('k', 1001)).toBe(0);
  });
});
