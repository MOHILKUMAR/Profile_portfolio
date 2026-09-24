declare namespace App {
  interface Locals {
    locale: import('./i18n/utils').Locale;
    supabase: import('@supabase/supabase-js').SupabaseClient;
    user: import('@supabase/supabase-js').User | null;
    isAdmin: boolean;
    /** Set when a public read failed, so the page is never cached. */
    degraded: boolean;
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_OG_IMAGE: string;
  readonly PUBLIC_CONTACT_EMAIL: string;
  readonly PUBLIC_GITHUB_URL: string;
  readonly PUBLIC_LINKEDIN_URL: string;
  /** Server only. Never prefix with PUBLIC_, that would ship it to the browser. */
  readonly WHATSAPP_NUMBER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
