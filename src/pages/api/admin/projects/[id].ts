import type { APIRoute } from 'astro';
import { getProjectById } from '../../../../lib/projects';
import { describeWriteError, parseProjectForm } from '../../../../lib/projectForm';
import { PROJECT_IMAGE_BUCKET } from '../../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  const id = params.id;
  if (!id) return redirect('/admin', 303);

  const existing = await getProjectById(locals.supabase, id);
  if (!existing) return redirect('/admin', 303);

  const form = await request.formData();
  const editUrl = `/admin/projects/${id}`;

  if (form.get('_action') === 'delete') {
    const { error } = await locals.supabase.from('projects').delete().eq('id', id);
    if (error) {
      console.error('project delete failed', error.message);
      return redirect(`${editUrl}?error=${encodeURIComponent(error.message)}`, 303);
    }

    // The row is gone, so a failed image cleanup is only worth a warning.
    if (existing.image_path) {
      const { error: storageError } = await locals.supabase.storage
        .from(PROJECT_IMAGE_BUCKET)
        .remove([existing.image_path]);
      if (storageError) console.warn('could not remove image', existing.image_path, storageError.message);
    }

    return redirect('/admin?deleted=1', 303);
  }

  const parsed = await parseProjectForm(form, locals.supabase, existing);
  if (!parsed.ok) {
    return redirect(`${editUrl}?error=${encodeURIComponent(parsed.error)}`, 303);
  }

  const { error } = await locals.supabase.from('projects').update(parsed.row).eq('id', id);

  if (error) {
    // The row still references the previous image, which commit() has not
    // touched yet, so the public page keeps working.
    await parsed.rollback();
    console.error('project update failed', error.message);
    return redirect(`${editUrl}?error=${encodeURIComponent(describeWriteError(error))}`, 303);
  }

  await parsed.commit();
  return redirect('/admin?saved=1', 303);
};
