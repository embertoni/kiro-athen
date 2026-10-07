-- 0014_username_to_email.sql
--
-- Login-by-username support. The frontend lets a user sign in with either an
-- email address or a username. Supabase Auth only authenticates by email, and
-- the email lives in auth.users (NOT in public.profiles), which is not
-- readable by the anon role. This SECURITY DEFINER function resolves a
-- username to its auth email so the client can then call
-- supabase.auth.signInWithPassword with the resolved email.
--
-- Security notes:
--   * SECURITY DEFINER so it can read auth.users while running as the owner.
--   * Lookup is case-insensitive on username (profiles.username is citext).
--   * Returns NULL when the username does not exist (the client then surfaces
--     a generic "invalid credentials" error, so this does not leak existence
--     beyond what a normal failed login would).
--   * Takes no part in authorization: knowing an email is not enough to log
--     in; the password is still verified by Supabase Auth.

create or replace function public.username_to_email(p_username text)
returns text
language sql
security definer
set search_path = public, auth
stable
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = p_username
  limit 1;
$$;

comment on function public.username_to_email(text) is
  'Resolve a username to its auth.users email for login-by-username. SECURITY DEFINER; returns NULL when not found.';

-- Allow anonymous (pre-auth) and authenticated callers to resolve a username.
grant execute on function public.username_to_email(text) to anon, authenticated;
