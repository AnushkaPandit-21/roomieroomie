-- get_feed: every hard filter, the exact weights, ranking boosts, pagination and caller check.
begin;
create extension if not exists pgtap with schema extensions;
\ir ../fixtures.psql

select plan(27);

-- Viewer: Testpur (test-only city, isolated from seed data), female, wants/shows female, Koramangala + HSR, ₹15,000, move-in +10 days.
select pg_temp.mk_user('me');

-- Should appear
select pg_temp.mk_user('twin');                                                      -- identical => 100%
select pg_temp.mk_user('budgetok', '{"budget": 19000}');                             -- within ±30%
select pg_temp.mk_user('hostok', '{"seeking": "have_place", "rent": 14000}');        -- rent share <= my budget
select pg_temp.mk_user('partial', '{"food": "non-veg", "smoking": "yes", "drinking": "okay", "sleep": "late",
  "cleanliness": 2, "guests": "often", "pets": "has_pets", "language": "{Tamil}", "areas": "{Whitefield}"}');
select pg_temp.mk_user('liker', '{"inactive_days": 10}');

-- Should NOT appear
select pg_temp.mk_user('othercity', '{"city": "Pune"}');
select pg_temp.mk_user('male', '{"gender": "male", "want": "{female,male}", "show": "{female,male}"}');
select pg_temp.mk_user('hidden', '{"show": "{male}"}');                              -- doesn't show to me
select pg_temp.mk_user('budgetfar', '{"budget": 25000}');                            -- outside ±30%
select pg_temp.mk_user('hostdear', '{"seeking": "have_place", "rent": 16000}');      -- rent share > my budget
select pg_temp.mk_user('latemove', '{"move_in_offset": 45}');                        -- 35 days apart
select pg_temp.mk_user('dealbreak', '{"food": "non-veg", "dealbreakers": "{food}"}'); -- their dealbreaker
select pg_temp.mk_user('paused', '{"paused": true}');
select pg_temp.mk_user('incomplete', '{"photos": 2}');
select pg_temp.mk_user('swiped');
select pg_temp.mk_user('blocker');
select pg_temp.mk_user('reported');
select pg_temp.mk_user('matched');

insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('me'), pg_temp.uid('swiped'), 'pass');
insert into public.reports_blocks (reporter_id, target_id, type) values (pg_temp.uid('blocker'), pg_temp.uid('me'), 'block');
insert into public.reports_blocks (reporter_id, target_id, type, reason) values (pg_temp.uid('me'), pg_temp.uid('reported'), 'report', 'spam');
insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('me'), pg_temp.uid('matched'), 'like');
insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('matched'), pg_temp.uid('me'), 'like');
insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('liker'), pg_temp.uid('me'), 'like');

create temp table feed as select * from public.get_feed(pg_temp.uid('me'));

-- ------------------------------------------------------------- inclusion
select ok(exists (select 1 from feed where profile_id = pg_temp.uid(l)), l || ' is in the feed')
from unnest(array['twin', 'budgetok', 'hostok', 'partial', 'liker']) l;

-- ------------------------------------------------------------- hard filters
select ok(not exists (select 1 from feed where profile_id = pg_temp.uid(l)), l || ' is filtered out')
from unnest(array['othercity', 'male', 'hidden', 'budgetfar', 'hostdear', 'latemove', 'dealbreak', 'paused',
                  'incomplete', 'swiped', 'blocker', 'reported', 'matched']) l;
select ok(not exists (select 1 from feed where profile_id = pg_temp.uid('me')), 'you never see yourself');

-- ------------------------------------------------------------- weights
select is((select match_score from feed where profile_id = pg_temp.uid('twin')), 100, 'identical profile scores 100');
-- partial: area 0 + food 3 + smoking 0 + drinking 5 + budget 15 + sleep 0 + clean 0 + guests 0 + pets 0 + lang 0 = 23
select is((select match_score from feed where profile_id = pg_temp.uid('partial')), 23, 'partial overlap scores exactly 23');
-- host: budget 15 * (1 - 1000/15000) = 14; area: listing area Koramangala already in shared areas => 25
select is((select match_score from feed where profile_id = pg_temp.uid('hostok')), 99, 'host budget closeness uses rent share');

-- ------------------------------------------------------------- boosts and order
-- liker: score 100, +10 liked you, no activity boost => 110; twin: 100 + 5 active => 105.
select is((select rank_score from feed where profile_id = pg_temp.uid('liker')), 110, 'people who liked you get +10');
select is((select rank_score from feed where profile_id = pg_temp.uid('twin')), 105, 'active in last 3 days gets +5');
select is((select profile_id from feed order by rank_score desc, profile_id limit 1), pg_temp.uid('liker'), 'feed is ordered by rank');

-- ------------------------------------------------------------- pagination
select is(
  (select array_agg(profile_id order by rank_score desc, profile_id) from (
     select profile_id, rank_score from public.get_feed(pg_temp.uid('me'), 2)
     union all
     select profile_id, rank_score from public.get_feed(
       pg_temp.uid('me'), 10,
       (select next_cursor from public.get_feed(pg_temp.uid('me'), 2) order by rank_score, profile_id desc limit 1))
   ) pages),
  (select array_agg(profile_id order by rank_score desc, profile_id) from feed),
  'cursor pages cover the feed exactly once, in order'
);

select pg_temp.claims('twin');
set local role authenticated;
select throws_ok(
  format('select * from public.get_feed(%L)', current_setting('test.me')),
  '42501', null, 'a user cannot load someone else''s feed'
);
reset role;

select * from finish();
rollback;
