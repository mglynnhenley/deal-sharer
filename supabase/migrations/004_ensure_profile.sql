-- Function that returns the current user's fund_id, creating the profile if missing.
-- This handles users who signed up before the trigger existed or when the trigger failed.
create or replace function get_my_fund_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _fund_id uuid;
  _domain text;
  _is_personal boolean;
  _email text;
begin
  -- Fast path: profile already exists
  select fund_id into _fund_id from profiles where id = auth.uid();
  if found then
    return _fund_id;
  end if;

  -- Profile missing — create it (same logic as handle_new_user trigger)
  select email into _email from auth.users where id = auth.uid();
  if _email is null then
    raise exception 'Not authenticated';
  end if;

  _domain := split_part(_email, '@', 2);

  select exists(select 1 from personal_domains where domain = _domain)
    into _is_personal;

  if _is_personal then
    insert into funds (is_personal) values (true) returning id into _fund_id;
  else
    insert into funds (domain) values (_domain)
      on conflict (domain) do nothing;
    select id into _fund_id from funds where domain = _domain;
  end if;

  insert into profiles (id, fund_id, email_domain)
    values (auth.uid(), _fund_id, _domain);

  return _fund_id;
end;
$$;
