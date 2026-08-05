-- Create HR profiles automatically for every future Supabase Auth user.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do update set email = excluded.email, full_name = coalesce(excluded.full_name, public.users.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Repair accounts created before the trigger existed.
insert into public.users (id, email, full_name)
select id, coalesce(email, ''), raw_user_meta_data ->> 'full_name'
from auth.users
on conflict (id) do update set email = excluded.email, full_name = coalesce(excluded.full_name, public.users.full_name);
