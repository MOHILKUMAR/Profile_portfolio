import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import { requireEnv } from './env';

export type ServerContext = {
  request: Request;
  cookies: AstroCookies;
};

/**
 * One Supabase client per request, reading and writing the auth cookies through
 * Astro so refreshed sessions are persisted on the response.
 */
export function createSupabaseClient(context: ServerContext): SupabaseClient {
  return createServerClient(requireEnv('PUBLIC_SUPABASE_URL'), requireEnv('PUBLIC_SUPABASE_ANON_KEY'), {
    cookies: {
      getAll() {
        const header = context.request.headers.get('Cookie') ?? '';
        return parseCookieHeader(header).map(({ name, value }) => ({ name, value: value ?? '' }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          context.cookies.set(name, value, {
            path: options?.path ?? '/',
            domain: options?.domain,
            maxAge: options?.maxAge,
            expires: options?.expires,
            // @supabase/ssr passes httpOnly: false so browser clients can read the
            // session. This app only ever talks to Supabase from the server, so
            // there is no reason to let page scripts see the token.
            httpOnly: true,
            secure: options?.secure ?? import.meta.env.PROD,
            sameSite: (options?.sameSite as 'lax' | 'strict' | 'none' | undefined) ?? 'lax',
          });
        }
      },
    },
  });
}

export const PROJECT_IMAGE_BUCKET = 'project-images';
