import type { SupabaseClient } from '@supabase/supabase-js';
import { PROJECT_IMAGE_BUCKET } from './supabase';
import { normalizeUrl, parseTechList, slugify, type Project, type ProjectTranslation } from './projects';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** SVG is deliberately excluded: it can carry script, and nothing here needs it. */
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export const TRANSLATABLE_LOCALES = ['hi', 'es'] as const;

export type ProjectRow = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  image_url: string | null;
  image_path: string | null;
  host_url: string | null;
  repo_url: string | null;
  tech: string[];
  translations: Record<string, ProjectTranslation>;
  featured: boolean;
  published: boolean;
  sort_order: number;
};

/**
 * Storage and the database cannot be written in one transaction, so the caller
 * gets the row plus the two halves of the fixup:
 *   commit   after the row is saved, drops the file the row no longer points at
 *   rollback if the save failed, drops the file that was just uploaded
 * Nothing destructive happens until the database write has actually landed.
 */
export type ParseResult =
  | { ok: true; row: ProjectRow; commit: () => Promise<void>; rollback: () => Promise<void> }
  | { ok: false; error: string };

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function checked(form: FormData, key: string): boolean {
  return form.get(key) !== null;
}

async function uploadImage(
  supabase: SupabaseClient,
  file: File,
  slug: string,
): Promise<{ url: string; path: string } | { error: string }> {
  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    return { error: `Unsupported image type "${file.type}". Use PNG, JPEG, WebP, AVIF or GIF.` };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.` };
  }

  const path = `${slug}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(PROJECT_IMAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    console.error('image upload failed', error.message);
    return { error: `Image upload failed: ${error.message}` };
  }

  const { data } = supabase.storage.from(PROJECT_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

async function removeImage(supabase: SupabaseClient, path: string | null): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(PROJECT_IMAGE_BUCKET).remove([path]);
  // A failed cleanup should not block the save, so this only warns.
  if (error) console.warn('could not remove old image', path, error.message);
}

/**
 * Turns the admin form into a database row, handling the image upload and
 * replacing or clearing a previous image when asked.
 */
export async function parseProjectForm(
  form: FormData,
  supabase: SupabaseClient,
  existing: Project | null = null,
): Promise<ParseResult> {
  const title = text(form, 'title');
  if (!title) return { ok: false, error: 'Title is required.' };

  // The easy mistake is pasting the live site link here, which slugify would
  // happily mangle into /projects/https-example-com-page. Catch it instead.
  const rawSlug = text(form, 'slug');
  if (/:\/\/|^www\.|\.[a-z]{2,}(\/|$)/i.test(rawSlug)) {
    return {
      ok: false,
      error:
        'The page address looks like a web link. Put the live site link in "Live site URL" instead. ' +
        'The page address is the short name in your own portfolio URL, for example "msg" for /projects/msg. ' +
        'Leave it blank to make one from the title.',
    };
  }

  const slug = slugify(rawSlug || title);
  if (!slug) {
    return { ok: false, error: 'Could not build a URL slug from that title. Enter one manually.' };
  }

  const translations: Record<string, ProjectTranslation> = {};
  for (const locale of TRANSLATABLE_LOCALES) {
    const entry: ProjectTranslation = {
      title: text(form, `${locale}_title`) || undefined,
      summary: text(form, `${locale}_summary`) || undefined,
      description: text(form, `${locale}_description`) || undefined,
    };
    if (entry.title || entry.summary || entry.description) translations[locale] = entry;
  }

  let imageUrl = existing?.image_url ?? null;
  let imagePath = existing?.image_path ?? null;

  // Deleted only once the row is saved, so a rejected save leaves the live
  // project pointing at a file that still exists.
  let supersededPath: string | null = null;
  // Deleted if the save is rejected, so a failed attempt leaves nothing behind.
  let uploadedPath: string | null = null;

  const file = form.get('image');
  const wantsRemoval = checked(form, 'remove_image');

  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadImage(supabase, file, slug);
    if ('error' in uploaded) return { ok: false, error: uploaded.error };
    supersededPath = imagePath;
    uploadedPath = uploaded.path;
    imageUrl = uploaded.url;
    imagePath = uploaded.path;
  } else if (wantsRemoval) {
    supersededPath = imagePath;
    imageUrl = null;
    imagePath = null;
  }

  const sortOrderRaw = Number.parseInt(text(form, 'sort_order'), 10);

  return {
    ok: true,
    commit: () => removeImage(supabase, supersededPath),
    rollback: () => removeImage(supabase, uploadedPath),
    row: {
      slug,
      title,
      summary: text(form, 'summary'),
      description: text(form, 'description'),
      image_url: imageUrl,
      image_path: imagePath,
      host_url: normalizeUrl(form.get('host_url')),
      repo_url: normalizeUrl(form.get('repo_url')),
      tech: parseTechList(form.get('tech')),
      translations,
      featured: checked(form, 'featured'),
      published: checked(form, 'published'),
      sort_order: Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0,
    },
  };
}

/** Postgres unique violation, surfaced as a readable message. */
export function describeWriteError(error: { code?: string; message: string }): string {
  if (error.code === '23505') {
    return 'Another project already uses that page address. Change the title or type a different page address.';
  }
  return error.message;
}
