import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_LOCALE, type Locale } from '../i18n/utils';

export type ProjectTranslation = {
  title?: string;
  summary?: string;
  description?: string;
};

export type Project = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image_url: string | null;
  image_path: string | null;
  host_url: string | null;
  repo_url: string | null;
  tech: string[];
  translations: Record<string, ProjectTranslation> | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  'id, slug, title, summary, description, image_url, image_path, host_url, repo_url, tech, translations, featured, published, sort_order, created_at, updated_at';

/**
 * Overlays the translation stored for a locale onto the base (English) record.
 * Any field left blank in the admin panel falls back to the English one, so a
 * partially translated project still renders completely.
 */
export function localizeProject(project: Project, locale: Locale): Project {
  if (locale === DEFAULT_LOCALE) return project;
  const overlay = project.translations?.[locale];
  if (!overlay) return project;

  return {
    ...project,
    title: overlay.title?.trim() || project.title,
    summary: overlay.summary?.trim() || project.summary,
    description: overlay.description?.trim() || project.description,
  };
}

/**
 * Public reads take locals rather than a bare client so that a failure can be
 * recorded on it. The middleware refuses to cache a page rendered after a
 * failed read; otherwise a brief outage would keep being served as "no
 * projects" long after Supabase had recovered.
 */
export async function listPublishedProjects(
  locals: App.Locals,
  options: { featuredOnly?: boolean; limit?: number } = {},
): Promise<Project[]> {
  let query = locals.supabase
    .from('projects')
    .select(COLUMNS)
    .eq('published', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false });

  if (options.featuredOnly) query = query.eq('featured', true);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) {
    console.error('listPublishedProjects failed', error.message);
    locals.degraded = true;
    return [];
  }
  return (data ?? []) as Project[];
}

/** Null means either "no such project" or "the read failed"; check locals.degraded. */
export async function getPublishedProjectBySlug(locals: App.Locals, slug: string): Promise<Project | null> {
  const { data, error } = await locals.supabase
    .from('projects')
    .select(COLUMNS)
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error) {
    console.error('getPublishedProjectBySlug failed', error.message);
    locals.degraded = true;
    return null;
  }
  return (data as Project) ?? null;
}

/** Admin listing: includes unpublished rows, which RLS only returns to admins. */
export async function listAllProjects(supabase: SupabaseClient): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(COLUMNS)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listAllProjects failed', error.message);
    return [];
  }
  return (data ?? []) as Project[];
}

export async function getProjectById(supabase: SupabaseClient, id: string): Promise<Project | null> {
  const { data, error } = await supabase.from('projects').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) {
    console.error('getProjectById failed', error.message);
    return null;
  }
  return (data as Project) ?? null;
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** Splits a comma or newline separated tech list into clean tags. */
export function parseTechList(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * Only http(s) links are allowed through, so a pasted "javascript:" value can
 * never end up in an href on the public site.
 */
export function normalizeUrl(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}
