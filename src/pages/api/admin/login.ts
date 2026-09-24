import type { APIRoute } from 'astro';
import { siteUrl } from '../../../lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const email = form.get('email');

  if (typeof email !== 'string' || !email.includes('@')) {
    return redirect('/admin/login?error=no_email', 303);
  }

  // Kept free of query parameters on purpose. Supabase checks this against the
  // Redirect URLs allow list, and an extra ?next= can fail an exact match, in
  // which case it quietly sends the link to the project's Site URL instead.
  // The email template appends ?token_hash=... to this, see README.
  const redirectTo = new URL('/admin/auth/callback', siteUrl(request));

  const { error } = await locals.supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: redirectTo.toString(),
      // Nobody can self register an admin account by requesting a link.
      shouldCreateUser: false,
    },
  });

  if (error) {
    console.error('signInWithOtp failed', error.message);

    // Supabase's shared SMTP allows only a few auth emails per hour. Saying so
    // matters, because the generic message sends people hunting through config
    // for a problem that is really just a throttle.
    if (/rate limit/i.test(error.message)) {
      return redirect('/admin/login?error=rate_limited', 303);
    }

    // shouldCreateUser is false, so an unregistered address errors here. Showing
    // that would turn this form into a way to test which addresses have accounts,
    // so it gets the same confirmation as a real send.
    if (/signups not allowed|not allowed for otp|user not found/i.test(error.message)) {
      return redirect('/admin/login?sent=1', 303);
    }

    return redirect('/admin/login?error=send_failed', 303);
  }

  return redirect('/admin/login?sent=1', 303);
};
