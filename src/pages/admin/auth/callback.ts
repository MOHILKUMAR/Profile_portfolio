import type { APIRoute } from 'astro';
import type { EmailOtpType } from '@supabase/supabase-js';

export const prerender = false;

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/admin';
  return raw;
}

/**
 * Lands here from the magic link email. Supabase can deliver the credential two
 * ways depending on the email template in use, so both are accepted:
 *   token_hash + type  (the SSR template, recommended, see README)
 *   code               (the default PKCE confirmation URL)
 */
export const GET: APIRoute = async ({ url, locals, redirect }) => {
  const next = safeNext(url.searchParams.get('next'));
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const code = url.searchParams.get('code');

  // Supabase reports its own failures on the query string.
  const errorCode = url.searchParams.get('error_code') ?? url.searchParams.get('error');
  if (errorCode) {
    const reason = errorCode.includes('expired') ? 'link_expired' : 'link_invalid';
    return redirect(`/admin/login?error=${reason}`, 303);
  }

  if (tokenHash && type) {
    const { error } = await locals.supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.error('verifyOtp failed', error.message);
      return redirect('/admin/login?error=link_invalid', 303);
    }
    return redirect(next, 303);
  }

  if (code) {
    const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('exchangeCodeForSession failed', error.message);
      return redirect('/admin/login?error=link_invalid', 303);
    }
    return redirect(next, 303);
  }

  return redirect('/admin/login?error=link_invalid', 303);
};
