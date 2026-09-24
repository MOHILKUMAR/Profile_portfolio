import type { APIRoute } from 'astro';
import { siteUrl } from '../lib/env';

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const origin = siteUrl(request);

  const body = [
    'User-agent: *',
    'Allow: /',
    // The admin panel also sends noindex, this just saves crawlers the request.
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    `Sitemap: ${new URL('/sitemap.xml', origin).href}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
