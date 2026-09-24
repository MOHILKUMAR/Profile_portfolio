-- Grant admin access to an existing Supabase user.
--
-- Step 1. Create the user FIRST, under Authentication > Users > Add user.
--         Sign-in is by magic link, so the password you set there is never
--         used, but the address must be real: it receives the sign-in link.
--
-- Step 2. Change the address on the line below and run this whole file.
--
-- The old version of this script used a plain INSERT ... SELECT, which quietly
-- inserted nothing when the address did not match a user, so it looked like it
-- had worked. This one fails loudly instead.

do $$
declare
  target_email text := 'mohil4280@gmail.com';
  target_id    uuid;
begin
  select id into target_id
  from auth.users
  where lower(email) = lower(trim(target_email));

  if target_id is null then
    raise exception
      'No user in auth.users has the address %. Create it under Authentication > Users first, and check for a typo. Run the SELECT at the bottom of this file to list the addresses that do exist.',
      target_email;
  end if;

  insert into public.admins (user_id, email)
  values (target_id, lower(trim(target_email)))
  on conflict (user_id) do nothing;

  raise notice 'Admin access granted to % (user_id %)', target_email, target_id;
end
$$;

-- Who exists, and who is an admin. Every user you want in the panel needs
-- is_admin = true here.
select
  u.email,
  u.id as user_id,
  u.created_at,
  (a.user_id is not null) as is_admin
from auth.users u
left join public.admins a on a.user_id = u.id
order by u.created_at desc;

-- If the address lookup keeps failing, skip it and use the user id straight from
-- Authentication > Users. Nothing to match, nothing to mistype:
--
-- insert into public.admins (user_id, email)
-- values ('00000000-0000-0000-0000-000000000000', 'you@example.com')
-- on conflict (user_id) do nothing;

-- To revoke access later:
-- delete from public.admins
-- where user_id = (select id from auth.users where lower(email) = lower('you@example.com'));
