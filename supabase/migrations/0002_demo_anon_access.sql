-- DEMO-GRADE ACCESS: the app has no sign-in yet, so the anon key gets full
-- access — the same trust level as the public demo sandbox. When planner
-- auth ships, DROP these policies and the org-scoped RLS in 0001 takes over.
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','venues','venue_table_layouts','venue_tables',
    'events','guests','guest_constraints','photos','checkin_log'
  ] loop
    execute format('create policy demo_anon_all on %I for all to anon using (true) with check (true)', t);
  end loop;
end $$;
