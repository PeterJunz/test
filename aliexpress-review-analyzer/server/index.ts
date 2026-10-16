import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

/**
 * Local proxy for AliExpress Review Analyzer Pro.
 * Keeps provider / Anthropic keys out of the browser, authenticates the UI with a shared
 * token, rate-limits requests, and pins the upstream host to the configured template.
 */
try {
  process.loadEnvFile?.('.env');
} catch {
  /* no .env file — environment variables only */
}

const config = loadConfig();
const server = createApp(config);

server.listen(config.port, config.host, () => {
  console.log(`Proxy listening on http://${config.host}:${config.port}`);
  console.log(`Allowed origins: ${config.allowedOrigins.join(', ')}`);
  console.log(`Review provider: ${config.provider.reviewsUrlTemplate ? (config.provider.name ?? 'configured') : 'not configured'}`);
  console.log(`AI analysis: ${config.anthropic.apiKey ? `server key, model ${config.anthropic.model}` : config.anthropic.allowClientKey ? 'client-supplied key only' : 'disabled'}`);
  if (config.accessTokenGenerated) {
    console.log('\nAPP_ACCESS_TOKEN was not set. Temporary token for this run (paste it in Settings → Data sources):');
    console.log(`  ${config.accessToken}\n`);
  }
});
