import { defineMiddleware } from 'astro:middleware';
import { createSupabaseClient } from './lib/supabase';
import { DEFAULT_LOCALE, isLocale } from './i18n/utils';

/** Reachable without a session, otherwise signing in would be impossible. */
const OPEN_ADMIN_PATHS = ['/admin/login', '/admin/auth/callback', '/api/admin/login', '/api/admin/logout'];

function isGuarded(pathname: string): boolean {
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) return false;
  return !OPEN_ADMIN_PATHS.some((open) => pathname === open || pathname.startsWith(`${open}/`));
}

/**
 * Public pages are the same for everyone, so Vercel's CDN may keep a copy for
 * 60 seconds, then keep serving it for up to 10 minutes while a fresh one is
 * fetched in the background. Browsers always check back with the CDN rather
 * than holding their own copy, so a published edit shows within about a minute.
 */
const PUBLIC_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';

async function withCacheHeaders(
  pathname: string,
  method: string,
  locals: App.Locals,
  response: Response,
): Promise<Response> {
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }

  if (method !== 'GET' && method !== 'HEAD') return response;
  if (response.status !== 200) return response;

  // Routes that set their own policy, such as the sitemap, keep it.
  if (response.headers.has('Cache-Control')) return response;

  // A Set-Cookie here means Supabase refreshed a session. Storing that in a
  // shared cache would hand one visitor's cookie to the next one.
  if (response.headers.has('Set-Cookie')) return response;

  // Components flag a failed read on locals while they render, and rendering
  // streams, so it can still be running when next() returns. Reading the body
  // to the end first is what makes the flag trustworthy. The data is fetched
  // before any HTML is written, so this costs nothing in time to first byte.
  const body = await response.text();
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', locals.degraded ? 'no-store' : PUBLIC_CACHE);
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const firstSegment = pathname.split('/').filter(Boolean)[0];
  context.locals.locale = isLocale(firstSegment) ? firstSegment : DEFAULT_LOCALE;

  const supabase = createSupabaseClient(context);
  context.locals.supabase = supabase;
  context.locals.user = null;
  context.locals.isAdmin = false;
  context.locals.degraded = false;

  const touchesAdmin = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

  if (touchesAdmin) {
    // getUser revalidates the JWT with Supabase rather than trusting the cookie.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;

    if (user) {
      const { data } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
      context.locals.isAdmin = Boolean(data);
    }

    if (isGuarded(pathname)) {
      const bounceTo = !user
        ? `/admin/login?next=${encodeURIComponent(pathname)}`
        : !context.locals.isAdmin
          ? '/admin/login?error=not_admin'
          : null;

      if (bounceTo) {
        // A 302 is not cacheable by default, but this redirect depends on who is
        // asking, so say so rather than relying on that.
        const bounce = context.redirect(bounceTo, 302);
        bounce.headers.set('Cache-Control', 'private, no-store');
        return bounce;
      }
    }
  }

  const response = await next();
  return withCacheHeaders(pathname, context.request.method, context.locals, response);
});
