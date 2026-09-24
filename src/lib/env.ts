/**
 * On Vercel, variables set in the project settings are real process variables
 * at runtime, so they are read fresh on every request. Locally, `astro dev`
 * loads .env into import.meta.env rather than process.env, hence both.
 */
export function readEnv(key: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env[key] : undefined;
  if (typeof fromProcess === 'string' && fromProcess.length > 0) return fromProcess;

  const fromVite = (import.meta.env as unknown as Record<string, unknown>)[key];
  if (typeof fromVite === 'string' && fromVite.length > 0) return fromVite;

  return undefined;
}

export function requireEnv(key: string): string {
  const value = readEnv(key);
  if (!value) {
    throw new Error(
      `Missing environment variable ${key}. Copy .env.example to .env for local dev, ` +
        `or add it under Project Settings > Environment Variables on Vercel.`,
    );
  }
  return value;
}

export function siteUrl(request: Request): string {
  return readEnv('PUBLIC_SITE_URL') ?? new URL(request.url).origin;
}
