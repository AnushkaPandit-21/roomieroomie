-- Discover filters only narrow get_feed; no filters = original result. Plus last-active rules.
begin;
create extension if not exists pgtap with schema extensions;
\ir ../fixtures.psql

select plan(11);

select pg_temp.mk_user('me');
select pg_temp.mk_user('alpha', '{"areas": "{Koramangala}", "budget": 14000}');
select pg_temp.mk_user('beta', '{"areas": "{\"HSR Layout\"}", "budget": 17000, "move_in_offset": 25}');
select pg_temp.mk_user('host', '{"areas": "{Indiranagar}", "seeking": "have_place", "rent": 12000}');

create temp table base as select profile_id from public.get_feed(pg_temp.uid('me'));

select is((select count(*)::int from base), 3, 'unfiltered feed has all 3 candidates');
select set_eq(
  'select profile_id from public.get_feed(' || quote_literal(pg_temp.uid('me')) || ', 20, null, null, null, null)',
  'select profile_id from base',
  'explicit null filters give the same result as no filters'
);
select set_eq(
  'select profile_id from public.get_feed(' || quote_literal(pg_temp.uid('me')) || ', 20, null, ''{}'', null, null)',
  'select profile_id from base',
  'an empty area list means no area filter'
);

-- The fixture puts every host's listing in Koramangala, so the host matches through its listing area.
select set_eq(
  format('select profile_id from public.get_feed(%L, p_areas => ''{koramangala}'')', pg_temp.uid('me')),
  format('select unnest(array[%L, %L]::uuid[])', pg_temp.uid('alpha'), pg_temp.uid('host')),
  'area filter matches case-insensitively, including a host''s listing area'
);
select set_eq(
  format('select profile_id from public.get_feed(%L, p_areas => ''{"HSR Layout"}'')', pg_temp.uid('me')),
  format('select %L::uuid', pg_temp.uid('beta')),
  'area filter excludes people without that area'
);
select set_eq(
  format('select profile_id from public.get_feed(%L, p_areas => ''{Indiranagar}'')', pg_temp.uid('me')),
  format('select %L::uuid', pg_temp.uid('host')),
  'area filter finds a host by profile area'
);
select set_eq(
  format('select profile_id from public.get_feed(%L, p_max_budget => 14000)', pg_temp.uid('me')),
  format('select unnest(array[%L, %L]::uuid[])', pg_temp.uid('alpha'), pg_temp.uid('host')),
  'budget filter uses rent share for hosts (12000) and max budget for seekers'
);
select set_eq(
  format('select profile_id from public.get_feed(%L, p_move_in_by => current_date + 20)', pg_temp.uid('me')),
  format('select unnest(array[%L, %L]::uuid[])', pg_temp.uid('alpha'), pg_temp.uid('host')),
  'move-in filter keeps people moving in on or before the date'
);
select is(
  (select count(*)::int from public.get_feed(pg_temp.uid('me'), 20, null, '{"HSR Layout"}', 15000, null)),
  0, 'filters combine (AND): HSR Layout + budget 15000 excludes beta (17000)'
);

-- Last active
update public.profiles set last_active_at = '2099-01-01' where id = pg_temp.uid('me');
select ok((select last_active_at <= now() from public.profiles where id = pg_temp.uid('me')),
  'last_active_at can never be set in the future');

update public.profiles set last_active_at = now() - interval '10 days' where id = pg_temp.uid('me');
select pg_temp.claims('me');
set local role authenticated;
select public.touch_last_active();
reset role;
select ok((select last_active_at > now() - interval '1 minute' from public.profiles where id = pg_temp.uid('me')),
  'touch_last_active() marks the caller active now');

select * from finish();
rollback;
