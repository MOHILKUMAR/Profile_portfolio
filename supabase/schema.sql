-- Portfolio schema.
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is idempotent, so re-running it is safe.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Admin allow list
-- ---------------------------------------------------------------------------
-- Being a Supabase user is not enough to write. A row here is what grants it.

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- Security definer so the policies below can call it without needing their own
-- read access to admins, which would otherwise recurse.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  summary      text not null default '',
  description  text not null default '',
  image_url    text,
  image_path   text,
  host_url     text,
  repo_url     text,
  tech         text[] not null default '{}',
  -- { "hi": { "title": "...", "summary": "...", "description": "..." }, "es": { ... } }
  translations jsonb not null default '{}'::jsonb,
  featured     boolean not null default false,
  published    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists projects_listing_idx
  on public.projects (published, sort_order desc, created_at desc);

create index if not exists projects_featured_idx
  on public.projects (featured) where published;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.admins   enable row level security;

drop policy if exists "projects_public_read"  on public.projects;
drop policy if exists "projects_admin_insert" on public.projects;
drop policy if exists "projects_admin_update" on public.projects;
drop policy if exists "projects_admin_delete" on public.projects;

-- Anonymous visitors see published rows. Admins also see their drafts.
create policy "projects_public_read" on public.projects
  for select to anon, authenticated
  using (published or public.is_admin());

create policy "projects_admin_insert" on public.projects
  for insert to authenticated
  with check (public.is_admin());

create policy "projects_admin_update" on public.projects
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "projects_admin_delete" on public.projects
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "admins_read_self" on public.admins;

-- The app checks "am I an admin", so reading only your own row is enough.
create policy "admins_read_self" on public.admins
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage for project photos
-- ---------------------------------------------------------------------------

-- Depending on how locked down the project is, the SQL editor may not own the
-- storage schema. Both blocks below report that and carry on instead of
-- aborting the script, which would otherwise leave everything after them unrun.

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'project-images',
    'project-images',
    true,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']
  )
  on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  raise notice 'Bucket project-images is ready.';
exception
  when insufficient_privilege or undefined_table then
    raise warning
      'Could not create the bucket from SQL (%). Create it by hand: Storage > New bucket, name project-images, Public enabled, 5 MB limit.',
      sqlerrm;
end
$$;

do $$
begin
  drop policy if exists "project_images_public_read"  on storage.objects;
  drop policy if exists "project_images_admin_insert" on storage.objects;
  drop policy if exists "project_images_admin_update" on storage.objects;
  drop policy if exists "project_images_admin_delete" on storage.objects;

  create policy "project_images_public_read" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'project-images');

  create policy "project_images_admin_insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'project-images' and public.is_admin());

  create policy "project_images_admin_update" on storage.objects
    for update to authenticated
    using (bucket_id = 'project-images' and public.is_admin())
    with check (bucket_id = 'project-images' and public.is_admin());

  create policy "project_images_admin_delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'project-images' and public.is_admin());

  raise notice 'Storage policies applied.';
exception
  when insufficient_privilege then
    raise warning
      'Could not create storage policies from SQL (%). Add them under Storage > Policies on the project-images bucket.',
      sqlerrm;
end
$$;

-- Verify. The bucket row must come back, otherwise uploads will fail.
select id, public, file_size_limit from storage.buckets where id = 'project-images';
