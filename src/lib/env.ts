import { env as workerEnv } from 'cloudflare:workers';

/**
 * Astro 6 removed Astro.locals.runtime, so worker bindings and secrets now come
 * straight from the cloudflare:workers module. Locally, `astro dev` reads .env
 * through import.meta.env, so we check both and prefer the worker binding.
 */
export function readEnv(key: string): string | undefined {
  const fromWorker = (workerEnv as unknown as Record<string, unknown> | undefined)?.[key];
  if (typeof fromWorker === 'string' && fromWorker.length > 0) return fromWorker;

  const fromVite = (import.meta.env as unknown as Record<string, unknown>)[key];
  if (typeof fromVite === 'string' && fromVite.length > 0) return fromVite;

  return undefined;
}

export function requireEnv(key: string): string {
  const value = readEnv(key);
  if (!value) {
    throw new Error(
      `Missing environment variable ${key}. Copy .env.example to .env for local dev, ` +
        `or set it with "npx wrangler secret put ${key}" for production.`,
    );
  }
  return value;
}

export function siteUrl(request: Request): string {
  return readEnv('PUBLIC_SITE_URL') ?? new URL(request.url).origin;
}
