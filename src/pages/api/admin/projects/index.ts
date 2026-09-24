import type { APIRoute } from 'astro';
import { describeWriteError, parseProjectForm } from '../../../../lib/projectForm';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const parsed = await parseProjectForm(form, locals.supabase);

  if (!parsed.ok) {
    return redirect(`/admin/projects/new?error=${encodeURIComponent(parsed.error)}`, 303);
  }

  const { error } = await locals.supabase.from('projects').insert(parsed.row);

  if (error) {
    // A duplicate slug is a normal validation failure, so do not leave the
    // image that was uploaded for this attempt sitting in the bucket.
    await parsed.rollback();
    console.error('project insert failed', error.message);
    return redirect(`/admin/projects/new?error=${encodeURIComponent(describeWriteError(error))}`, 303);
  }

  await parsed.commit();
  return redirect('/admin?created=1', 303);
};
