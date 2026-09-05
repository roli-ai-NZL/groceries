-- Roland's groceries — household list (Supabase free tier)
--
-- 1. Create a free project at https://supabase.com
-- 2. Open SQL Editor → New query
-- 3. Replace YOUR_HOUSEHOLD_ACCESS_CODE below with a long passphrase
--    (you will type this on phone and laptop — not an email password)
-- 4. Run this whole file once
--
-- The table is not world-writable. The anon key can only call the two
-- functions below, and those only succeed with the correct access code.
-- The code is stored as a bcrypt hash (pgcrypto), never as plain text.

create extension if not exists pgcrypto;

create table if not exists public.household_lists (
  id text primary key,
  passphrase_hash text not null,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint household_lists_items_array check (jsonb_typeof(items) = 'array')
);

alter table public.household_lists enable row level security;

revoke all on table public.household_lists from anon, authenticated, public;

-- Read the list only if the access code matches.
create or replace function public.get_household_list(access_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.household_lists where id = 'roland') then
    raise exception 'Household list is not set up. Run supabase/schema.sql in the SQL editor.'
      using errcode = 'P0002';
  end if;

  select jsonb_build_object('items', h.items, 'updated_at', h.updated_at)
    into result
  from public.household_lists h
  where h.id = 'roland'
    and h.passphrase_hash = crypt(access_code, h.passphrase_hash);

  if result is null then
    raise exception 'Invalid access code' using errcode = '28000';
  end if;

  return result;
end;
$$;

-- Replace the list only if the access code matches. Last write wins.
create or replace function public.save_household_list(
  access_code text,
  new_items jsonb,
  client_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if jsonb_typeof(new_items) is distinct from 'array' then
    raise exception 'items must be a JSON array' using errcode = '22023';
  end if;

  update public.household_lists h
  set
    items = new_items,
    updated_at = client_updated_at
  where h.id = 'roland'
    and h.passphrase_hash = crypt(access_code, h.passphrase_hash)
  returning jsonb_build_object('items', h.items, 'updated_at', h.updated_at)
  into result;

  if result is null then
    raise exception 'Invalid access code' using errcode = '28000';
  end if;

  return result;
end;
$$;

revoke all on function public.get_household_list(text) from public;
revoke all on function public.save_household_list(text, jsonb, timestamptz) from public;
grant execute on function public.get_household_list(text) to anon, authenticated;
grant execute on function public.save_household_list(text, jsonb, timestamptz) to anon, authenticated;

-- Replace YOUR_HOUSEHOLD_ACCESS_CODE before running.
-- Re-running this file will not overwrite an existing row or passphrase.
insert into public.household_lists (id, passphrase_hash, items)
values (
  'roland',
  crypt('YOUR_HOUSEHOLD_ACCESS_CODE', gen_salt('bf')),
  '[]'::jsonb
)
on conflict (id) do nothing;

-- To change the code later (then unlock again on each device):
-- update public.household_lists
-- set passphrase_hash = crypt('NEW_HOUSEHOLD_ACCESS_CODE', gen_salt('bf'))
-- where id = 'roland';
