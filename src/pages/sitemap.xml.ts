import type { APIRoute } from 'astro';
import { listPublishedProjects } from '../lib/projects';
import { LOCALES, LOCALE_TAGS, localizePath } from '../i18n/utils';
import { siteUrl } from '../lib/env';

export const prerender = false;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ request, locals }) => {
  const origin = siteUrl(request);
  const projects = await listPublishedProjects(locals);

  const paths = [
    { path: '/', lastmod: null as string | null },
    { path: '/projects', lastmod: null },
    { path: '/play', lastmod: null },
    ...projects.map((project) => ({
      path: `/projects/${project.slug}`,
      lastmod: project.updated_at,
    })),
  ];

  // Every path exists in all three locales, and each entry cross references the
  // others so search engines treat them as translations rather than duplicates.
  const entries = paths.flatMap(({ path, lastmod }) => {
    const alternates = LOCALES.map((locale) => ({
      locale,
      href: new URL(localizePath(path, locale), origin).href,
    }));

    const alternateTags = alternates
      .map(
        (alternate) =>
          `    <xhtml:link rel="alternate" hreflang="${LOCALE_TAGS[alternate.locale]}" href="${escapeXml(alternate.href)}" />`,
      )
      .join('\n');

    return alternates.map(
      (alternate) =>
        `  <url>\n` +
        `    <loc>${escapeXml(alternate.href)}</loc>\n` +
        (lastmod ? `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>\n` : '') +
        `${alternateTags}\n` +
        `  </url>`,
    );
  });

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${entries.join('\n')}\n` +
    `</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // A sitemap missing every project would tell crawlers they were gone.
      'Cache-Control': locals.degraded ? 'no-store' : 'public, max-age=0, s-maxage=3600',
    },
  });
};
