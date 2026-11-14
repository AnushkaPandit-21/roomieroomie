-- Rooms: who appears, filters, paging, ordering, and "I'm interested" = a like on the host.
begin;
create extension if not exists pgtap with schema extensions;
\ir ../fixtures.psql

select plan(12);

select pg_temp.mk_user('me');
-- Fixture listings are always in Koramangala and available in 10 days.
select pg_temp.mk_user('h_cheap', '{"seeking": "have_place", "rent": 9000}');
select pg_temp.mk_user('h_pricey', '{"seeking": "have_place", "rent": 40000}');
select pg_temp.mk_user('h_male', '{"seeking": "have_place", "rent": 12000, "gender": "male", "show": "{female,male}"}');
select pg_temp.mk_user('h_smoker', '{"seeking": "have_place", "rent": 12000, "smoking": "yes"}');
select pg_temp.mk_user('h_strict', '{"seeking": "have_place", "rent": 12000, "dealbreakers": "{food}", "food": "non-veg"}');
select pg_temp.mk_user('h_paused', '{"seeking": "have_place", "rent": 12000, "paused": true}');
select pg_temp.mk_user('h_far', '{"seeking": "have_place", "rent": 12000, "city": "Elsewhere"}');
select pg_temp.mk_user('h_late', '{"seeking": "have_place", "rent": 12000, "move_in_offset": 200}');
select pg_temp.mk_user('seeker');

-- Make h_late's room available much later than the others.
update public.listings set available_from = current_date + 120 where host_id = pg_temp.uid('h_late');

select pg_temp.claims('me');
set local role authenticated;

create temp table rooms as select profile_id, match_score, listing from public.get_rooms(50);

select set_eq(
  'select profile_id from rooms',
  format('select unnest(array[%L, %L, %L, %L]::uuid[])', pg_temp.uid('h_cheap'), pg_temp.uid('h_pricey'), pg_temp.uid('h_smoker'), pg_temp.uid('h_late')),
  'hosts in my city with listings; excludes wrong gender, dealbreaker conflicts, paused, other cities and seekers'
);
select ok((select bool_and(listing ? 'rent' and not (listing ? 'address')) from rooms), 'every room has listing details and never an address');
select ok(
  (select count(*) = 0 from rooms r1, rooms r2
   where r1.match_score < r2.match_score and r1.profile_id <> r2.profile_id
     and r1.ctid < r2.ctid),
  'rooms are ordered by match % (highest first)'
);

select set_eq(
  'select profile_id from public.get_rooms(50, null, null, 12000)',
  format('select unnest(array[%L, %L, %L]::uuid[])', pg_temp.uid('h_cheap'), pg_temp.uid('h_smoker'), pg_temp.uid('h_late')),
  'max rent filter'
);
select set_eq(
  'select profile_id from public.get_rooms(50, null, null, null, current_date + 30)',
  format('select unnest(array[%L, %L, %L]::uuid[])', pg_temp.uid('h_cheap'), pg_temp.uid('h_pricey'), pg_temp.uid('h_smoker')),
  'available-by filter'
);
select is((select count(*)::int from public.get_rooms(50, null, '{koramangala}')), 4, 'area filter is case-insensitive');
select is((select count(*)::int from public.get_rooms(50, null, '{Indiranagar}')), 0, 'area filter excludes other areas');

-- Paging returns every room exactly once.
select is((select count(*)::int from public.get_rooms(2)), 2, 'page size is respected');
select is(
  (select count(*)::int from public.get_rooms(50, (select next_cursor from public.get_rooms(2) offset 1 limit 1))),
  2, 'the cursor returns the remaining rooms'
);

-- "I'm interested" = like on the host's first room photo; they leave Rooms.
insert into public.swipes (swiper_id, target_id, action, liked_item, comment)
values (pg_temp.uid('me'), pg_temp.uid('h_cheap'), 'like',
        (select (listing -> 'room_photos' -> 0 ->> 'id')::uuid from rooms where profile_id = pg_temp.uid('h_cheap')),
        'Can I visit on Saturday?');
select ok(not exists (select 1 from public.get_rooms(50) where profile_id = pg_temp.uid('h_cheap')), 'an interested host leaves Rooms');

reset role;
select is(
  (select comment from public.swipes where swiper_id = pg_temp.uid('me') and target_id = pg_temp.uid('h_cheap')),
  'Can I visit on Saturday?', 'the interest is a like (with a note) on the host'
);
select ok(not has_function_privilege('anon', 'public.get_rooms(integer, text, text[], integer, date)', 'execute'), 'anon cannot call get_rooms');

select * from finish();
rollback;
