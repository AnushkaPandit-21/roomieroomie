-- Likes You: who appears, paging, like-back match, and private.match_score == get_feed's score.
begin;
create extension if not exists pgtap with schema extensions;
\ir ../fixtures.psql

select plan(14);

select pg_temp.mk_user('me');
select pg_temp.mk_user('fan1', '{"food": "non-veg", "areas": "{Indiranagar}"}');
select pg_temp.mk_user('fan2', '{"budget": 18000, "sleep": "late"}');
select pg_temp.mk_user('fan3');
select pg_temp.mk_user('crossed');
select pg_temp.mk_user('paused_fan', '{"paused": true}');
select pg_temp.mk_user('blocked_fan');
select pg_temp.mk_user('host', '{"seeking": "have_place", "rent": 13000, "areas": "{Whitefield}"}');

-- private.match_score agrees with get_feed for every candidate (before anyone swipes).
select is(
  (select count(*)::int from public.get_feed(pg_temp.uid('me')) f
   where f.match_score is distinct from private.match_score(pg_temp.uid('me'), f.profile_id)),
  0, 'private.match_score matches get_feed''s match % for every profile'
);
select ok((select count(*) from public.get_feed(pg_temp.uid('me'))) >= 5, 'the comparison covered several profiles, incl. a host');

-- Likes on "me" (fan1 on a photo with a comment), spaced in time so the order is deterministic.
insert into public.swipes (swiper_id, target_id, action, liked_item, comment, created_at)
values (pg_temp.uid('fan1'), pg_temp.uid('me'), 'like',
        (select id from public.photos where profile_id = pg_temp.uid('me') order by position limit 1),
        'Love this photo', now() - interval '3 hours');
insert into public.swipes (swiper_id, target_id, action, created_at) values
  (pg_temp.uid('fan2'), pg_temp.uid('me'), 'like', now() - interval '2 hours'),
  (pg_temp.uid('fan3'), pg_temp.uid('me'), 'like', now() - interval '1 hour'),
  (pg_temp.uid('crossed'), pg_temp.uid('me'), 'like', now()),
  (pg_temp.uid('paused_fan'), pg_temp.uid('me'), 'like', now()),
  (pg_temp.uid('blocked_fan'), pg_temp.uid('me'), 'like', now());
-- I already crossed "crossed"; I blocked "blocked_fan". A pass on me never shows.
insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('me'), pg_temp.uid('crossed'), 'pass');
insert into public.reports_blocks (reporter_id, target_id, type) values (pg_temp.uid('me'), pg_temp.uid('blocked_fan'), 'block');
insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('host'), pg_temp.uid('me'), 'pass');
-- The insert trigger stamps server time (one value per transaction), so space the likes out afterwards.
update public.swipes set created_at = now() - interval '3 hours' where swiper_id = pg_temp.uid('fan1') and target_id = pg_temp.uid('me');
update public.swipes set created_at = now() - interval '2 hours' where swiper_id = pg_temp.uid('fan2') and target_id = pg_temp.uid('me');
update public.swipes set created_at = now() - interval '1 hour' where swiper_id = pg_temp.uid('fan3') and target_id = pg_temp.uid('me');

select set_config('test.fan2_score', private.match_score(pg_temp.uid('me'), pg_temp.uid('fan2'))::text, false);

select pg_temp.claims('me');
set local role authenticated;

select results_eq(
  'select profile_id from public.get_likes_you()',
  format('select unnest(array[%L, %L, %L]::uuid[])', pg_temp.uid('fan3'), pg_temp.uid('fan2'), pg_temp.uid('fan1')),
  'Likes You lists pending likes newest first; crossed, paused, blocked and passes are excluded'
);
select is(public.get_likes_you_count(), 3, 'count matches the list');
select is(
  (select comment from public.get_likes_you() where profile_id = pg_temp.uid('fan1')),
  'Love this photo', 'the comment is returned'
);
select is(
  (select liked_item from public.get_likes_you() where profile_id = pg_temp.uid('fan1')),
  (select id from public.photos where profile_id = pg_temp.uid('me') order by position limit 1),
  'the liked photo is returned'
);
select ok(
  (select jsonb_array_length(photos) = 3 and jsonb_array_length(prompts) = 3 and preferences ? 'religion'
   from public.get_likes_you() where profile_id = pg_temp.uid('fan1')),
  'card data (photos, prompts, preferences) is included'
);
select is(
  (select match_score from public.get_likes_you() where profile_id = pg_temp.uid('fan2')),
  current_setting('test.fan2_score')::integer,
  'match % is the shared score'
);

-- Paging: two pages of 2 and 1.
select is((select count(*)::int from public.get_likes_you(2)), 2, 'page size is respected');
select results_eq(
  format('select profile_id from public.get_likes_you(2, %L)',
         (select next_cursor from public.get_likes_you(2) order by liked_at asc limit 1)),
  format('select %L::uuid', pg_temp.uid('fan1')),
  'the cursor continues with the next (older) like'
);

-- Like back -> match created by the trigger; they leave Likes You.
insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('me'), pg_temp.uid('fan2'), 'like');
select ok(
  exists (select 1 from public.matches
          where user_a = least(pg_temp.uid('me'), pg_temp.uid('fan2')) and user_b = greatest(pg_temp.uid('me'), pg_temp.uid('fan2'))),
  'liking back creates the match'
);
select is(public.get_likes_you_count(), 2, 'a liked-back person leaves Likes You');

-- Crossing removes them too.
insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('me'), pg_temp.uid('fan3'), 'pass');
select is(public.get_likes_you_count(), 1, 'a crossed person leaves Likes You');

reset role;
select ok(not has_function_privilege('anon', 'public.get_likes_you(integer, text)', 'execute'), 'anon cannot call get_likes_you');

select * from finish();
rollback;
