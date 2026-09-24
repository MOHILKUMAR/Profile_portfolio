import type { APIRoute } from 'astro';
import { readEnv } from '../../../lib/env';
import { DEFAULT_LOCALE, isLocale, useTranslations } from '../../../i18n/utils';

export const prerender = false;

/**
 * The WhatsApp number lives only in the server-side WHATSAPP_NUMBER variable
 * and is never written into a page, a script bundle or the repository. The
 * public button posts here and is redirected into WhatsApp, so scrapers
 * reading the HTML or crawlers following links never see it.
 *
 * It is deliberately POST only: crawlers follow links but do not submit forms.
 * It cannot hide the number from someone who opens the chat, since WhatsApp
 * shows it there by design.
 */
export const POST: APIRoute = async ({ request }) => {
  const number = readEnv('WHATSAPP_NUMBER')?.replace(/\D/g, '');
  if (!number) {
    return new Response('WhatsApp contact is not configured.', { status: 404 });
  }

  const form = await request.formData();
  const rawLocale = form.get('locale');
  const t = useTranslations(isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE);

  // encodeURIComponent writes spaces as %20. URLSearchParams would write them
  // as +, which not every WhatsApp client turns back into a space.
  const chat = `https://wa.me/${number}?text=${encodeURIComponent(t('contact.whatsappMessage'))}`;

  return new Response(null, {
    status: 303,
    headers: {
      Location: chat,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
};
