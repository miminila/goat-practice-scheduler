-- Step 2 of 2: LOCKDOWN. Run ONLY after all of these are true:
--   1. The pull request with the new Coach View login is merged and deployed.
--   2. Coach accounts exist in Supabase Auth and their emails are in public.app_admins.
--   3. Any temporary test rows in public.app_admins are gone.
-- Running it earlier would break the live booking app.
--
-- What it does:
--   * Removes the old "anyone can do anything" policies on the goat practice tables.
--   * Gives each role only the table privileges it needs (students: add a booking and
--     read the schedule; coaches: manage everything; no one gets TRUNCATE/TRIGGER/REFERENCES).
--   * Trims the extra privileges on the other tables without changing what any app can do
--     (needed because Supabase stops auto-granting access to new tables on Oct 30, 2026).
--
-- Roll back access with:
--   grant all on all tables in schema public to anon, authenticated, service_role;
-- (this restores broad privileges; the old policies would also need re-creating).

begin;

-- Safety check: refuse to run if nobody could sign in as a coach afterwards.
do $$
begin
  if not exists (select 1 from public.app_admins) then
    raise exception 'public.app_admins is empty. Add the coach emails first, otherwise nobody could manage bookings.';
  end if;
  if exists (select 1 from public.app_admins where email like '%@example.invalid') then
    raise exception 'Remove the temporary test rows from public.app_admins first.';
  end if;
end
$$;

-- 1. Remove the old open policies on the goat practice tables.
drop policy if exists "Allow all on goat_bookings"      on public.goat_bookings;
drop policy if exists "Allow all on goat_blocked_days"  on public.goat_blocked_days;
drop policy if exists "Allow all on goat_day_hours"     on public.goat_day_hours;
drop policy if exists "Allow anonymous access"          on public.goat_settings;

-- 2. Goat practice tables: least-privilege grants.
revoke all on public.goat_bookings, public.goat_blocked_days, public.goat_day_hours, public.goat_settings
  from anon, authenticated;

-- Students: add a booking; read the (non-personal) schedule settings.
grant insert on public.goat_bookings to anon;
grant select on public.goat_blocked_days, public.goat_day_hours, public.goat_settings to anon;

-- Coaches (policies additionally require membership in public.app_admins).
grant select, insert, update, delete
  on public.goat_bookings, public.goat_blocked_days, public.goat_day_hours, public.goat_settings
  to authenticated;

grant select, insert, update, delete
  on public.goat_bookings, public.goat_blocked_days, public.goat_day_hours, public.goat_settings
  to service_role;

-- 3. Coach allowlist: only the is_admin() function and service_role can see it.
revoke all on public.app_admins from anon, authenticated;
grant select, insert, update, delete on public.app_admins to service_role;

revoke all on function public.is_admin()                               from public;
revoke all on function public.get_taken_slots()                        from public;
revoke all on function public.find_my_bookings(text)                   from public;
revoke all on function public.cancel_my_booking(text, integer, text)   from public;
grant execute on function public.is_admin()                             to anon, authenticated, service_role;
grant execute on function public.get_taken_slots()                      to anon, authenticated;
grant execute on function public.find_my_bookings(text)                 to anon, authenticated;
grant execute on function public.cancel_my_booking(text, integer, text) to anon, authenticated;

-- 4. Other tables: same access as today, minus privileges nothing uses.
--    (Their open policies are NOT changed here. See the review notes in the pull request.)
revoke all on public.bookings, public.blocked_days, public.settings,
              public.utm_links, public.site_pages, public.campaign_presets
  from anon, authenticated;

grant select, insert, delete on public.bookings     to anon, authenticated;
grant select, insert, delete on public.blocked_days to anon, authenticated;
grant select, insert, update on public.settings     to anon, authenticated;

grant select, insert, delete on public.utm_links        to anon;
grant select                 on public.site_pages       to anon;
grant select                 on public.campaign_presets to anon;

grant select, insert, update, delete
  on public.bookings, public.blocked_days, public.settings,
     public.utm_links, public.site_pages, public.campaign_presets
  to service_role;

commit;

-- Verify afterwards:
--   select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--   where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
--   group by 1, 2 order by 1, 2;
--
-- Template for any NEW table after Oct 30 (put in the same migration that creates it):
--   grant select on public.new_table to anon;                              -- only if the public should read it
--   grant select, insert, update, delete on public.new_table to authenticated;
--   grant select, insert, update, delete on public.new_table to service_role;
