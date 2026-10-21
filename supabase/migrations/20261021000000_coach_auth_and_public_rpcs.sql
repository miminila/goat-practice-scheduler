-- Step 1 of 2: ADDITIVE ONLY. Already applied to the live database (as
-- "coach_auth_and_public_rpcs_additions"); safe to run while the current app is live.
-- Adds an admin allowlist, safe public functions, and admin/public policies.
-- Nothing existing is removed or changed; the old open policies keep working
-- until step 2 (supabase/cutover/lock_down_goat_tables.sql) is run.
-- Tightening (revokes, dropping old policies) is deliberately left to step 2.

-- ---------------------------------------------------------------------------
-- 1. Admin allowlist (coaches who may manage bookings)
-- ---------------------------------------------------------------------------
create table if not exists public.app_admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- No policies on purpose: the API cannot read or write this table directly.
-- Only the SECURITY DEFINER function below (and service_role) can see it.
alter table public.app_admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Safe public functions (no names, emails, or phone numbers exposed)
-- ---------------------------------------------------------------------------

-- Which slots are taken (date + time only).
create or replace function public.get_taken_slots()
returns table(date text, slot_time integer)
language sql
stable
security definer
set search_path = public
as $$
  select b.date, b.slot_time from public.goat_bookings b;
$$;

-- A student's own upcoming bookings, looked up by the email they booked with.
-- Returns only date and slot, never anyone's name or phone.
create or replace function public.find_my_bookings(p_email text)
returns table(date text, slot_time integer, slot_label text)
language sql
stable
security definer
set search_path = public
as $$
  select b.date, b.slot_time, b.slot_label
  from public.goat_bookings b
  where lower(b.email) = lower(trim(p_email))
    and b.date >= to_char(current_date - 1, 'YYYY-MM-DD')
  order by b.date, b.slot_time;
$$;

-- Cancel one booking, only if the email matches.
create or replace function public.cancel_my_booking(p_date text, p_slot_time integer, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.goat_bookings b
  where b.date = p_date
    and b.slot_time = p_slot_time
    and lower(b.email) = lower(trim(p_email));
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

grant execute on function public.is_admin()                             to anon, authenticated, service_role;
grant execute on function public.get_taken_slots()                      to anon, authenticated;
grant execute on function public.find_my_bookings(text)                 to anon, authenticated;
grant execute on function public.cancel_my_booking(text, integer, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. New policies (added alongside the old open ones)
-- ---------------------------------------------------------------------------

-- Students can create a booking; they cannot read, change, or delete rows.
create policy "goat_bookings_public_insert" on public.goat_bookings
  for insert to anon, authenticated
  with check (true);

-- Coaches (allowlisted, signed in) can do everything.
create policy "goat_bookings_admin_all" on public.goat_bookings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Schedule settings are not personal data: everyone can read, only coaches write.
create policy "goat_blocked_days_public_read" on public.goat_blocked_days
  for select to anon, authenticated using (true);
create policy "goat_blocked_days_admin_write" on public.goat_blocked_days
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "goat_day_hours_public_read" on public.goat_day_hours
  for select to anon, authenticated using (true);
create policy "goat_day_hours_admin_write" on public.goat_day_hours
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "goat_settings_public_read" on public.goat_settings
  for select to anon, authenticated using (true);
create policy "goat_settings_admin_write" on public.goat_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
