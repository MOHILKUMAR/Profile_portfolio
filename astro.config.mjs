// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Canonical and hreflang URLs are built from `site` at build time. Vercel
// exposes the production domain to every build, previews included, so they
// all point search engines at production even before PUBLIC_SITE_URL is set.
const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL;

// https://astro.build/config
export default defineConfig({
  site:
    process.env.PUBLIC_SITE_URL ||
    (vercelProduction ? `https://${vercelProduction}` : 'http://localhost:4321'),
  output: 'server',
  adapter: vercel(),

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'hi', 'es'],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  fonts: [
    {
      name: 'Outfit',
      cssVariable: '--font-outfit',
      provider: fontProviders.google(),
      weights: [400, 500, 600, 700],
      styles: ['normal'],
      subsets: ['latin'],
    },
    {
      // Outfit has no Devanagari coverage, so Hindi falls through to this.
      // No fallbacks: by default Astro appends an Arial stand-in that claims
      // every character, plus sans-serif. Since this font is listed before
      // Outfit, those would take over all English text on every page.
      name: 'Noto Sans Devanagari',
      cssVariable: '--font-devanagari',
      provider: fontProviders.google(),
      weights: [400, 600],
      styles: ['normal'],
      subsets: ['devanagari'],
      fallbacks: [],
      optimizedFallbacks: false,
    },
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
