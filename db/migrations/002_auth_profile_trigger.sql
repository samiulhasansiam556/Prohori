
-- Prohori | Step 2 | Automatic profile creation
-- New users receive viewer role by default.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    tenant_id,
    role
  )
  values (
    new.id,
    '11111111-1111-4111-8111-111111111111',
    'viewer'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Recreate trigger safely.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Prevent direct invocation by client roles.
revoke all on function public.handle_new_user()
from public, anon, authenticated;
