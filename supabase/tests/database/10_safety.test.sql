-- Auto-hide after 3 reports (until reviewed), message/report rate limits, push webhook no-op.
begin;
create extension if not exists pgtap with schema extensions;
\ir ../fixtures.psql

select plan(14);

select pg_temp.mk_user('me');
select pg_temp.mk_user('target', '{"seeking": "have_place", "rent": 12000}');
select pg_temp.mk_user('r1');
select pg_temp.mk_user('r2');
select pg_temp.mk_user('r3');
select pg_temp.mk_user('chatty');
select pg_temp.mk_user('friend');

-- target likes me so they'd be in my Likes You, Discover and Rooms.
insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('target'), pg_temp.uid('me'), 'like');

create function pg_temp.visible_to_me(label text) returns text language plpgsql as $fx$
declare result text;
begin
  perform pg_temp.claims('me');
  set local role authenticated;
  select concat_ws(',',
    case when exists (select 1 from public.get_feed(pg_temp.uid('me')) where profile_id = pg_temp.uid(label)) then 'feed' end,
    case when exists (select 1 from public.get_rooms(50) where profile_id = pg_temp.uid(label)) then 'rooms' end,
    case when exists (select 1 from public.get_likes_you() where profile_id = pg_temp.uid(label)) then 'likes' end
  ) into result;
  reset role;
  return result;
end $fx$;

select is(pg_temp.visible_to_me('target'), 'feed,rooms,likes', 'before reports: visible in Discover, Rooms and Likes You');

insert into public.reports_blocks (reporter_id, target_id, type, reason) values
  (pg_temp.uid('r1'), pg_temp.uid('target'), 'report', 'Fake profile'),
  (pg_temp.uid('r2'), pg_temp.uid('target'), 'report', 'Scam');
select is(pg_temp.visible_to_me('target'), 'feed,rooms,likes', 'two reports: still visible');

insert into public.reports_blocks (reporter_id, target_id, type, reason) values
  (pg_temp.uid('r3'), pg_temp.uid('target'), 'report', 'Harassment');
select is(pg_temp.visible_to_me('target'), '', 'three reports from different people: hidden everywhere');
select is((select reporters::int from private.pending_review where profile_id = pg_temp.uid('target')), 3, 'listed for review with the reporters count');

-- The owner reviews and clears them: visible again; old reports no longer count.
insert into private.report_reviews (profile_id, note) values (pg_temp.uid('target'), 'checked, fine');
update private.report_reviews set cleared_at = now() + interval '1 second' where profile_id = pg_temp.uid('target');
select is(pg_temp.visible_to_me('target'), 'feed,rooms,likes', 'cleared after review: visible again');
select ok(not exists (select 1 from private.pending_review where profile_id = pg_temp.uid('target')), 'no longer pending review');

-- Private moderation data is not reachable by app users.
select ok(not has_table_privilege('authenticated', 'private.report_reviews', 'select'), 'users cannot read reviews');
select ok(not has_schema_privilege('anon', 'private', 'usage') or not has_table_privilege('anon', 'private.pending_review', 'select'), 'anon cannot read the review list');

-- Message rate limit: 60 per minute.
insert into public.swipes (swiper_id, target_id, action) values
  (pg_temp.uid('chatty'), pg_temp.uid('friend'), 'like'), (pg_temp.uid('friend'), pg_temp.uid('chatty'), 'like');
insert into public.messages (match_id, sender_id, body)
select m.id, pg_temp.uid('chatty'), 'msg ' || k
from public.matches m, generate_series(1, 60) k
where m.user_a = least(pg_temp.uid('chatty'), pg_temp.uid('friend')) and m.user_b = greatest(pg_temp.uid('chatty'), pg_temp.uid('friend'));
select is((select count(*)::int from public.messages where sender_id = pg_temp.uid('chatty')), 60, '60 messages in a minute are allowed (push webhook is a no-op without secrets)');
select throws_ok(
  format('insert into public.messages (match_id, sender_id, body) select id, %L, ''one more'' from public.matches where user_a = least(%L::uuid, %L::uuid) and user_b = greatest(%L::uuid, %L::uuid)',
         pg_temp.uid('chatty'), pg_temp.uid('chatty'), pg_temp.uid('friend'), pg_temp.uid('chatty'), pg_temp.uid('friend')),
  'P0001', 'message_rate_limit_reached', 'the 61st message in a minute is refused'
);
select lives_ok(
  format('insert into public.messages (match_id, sender_id, body) select id, %L, ''hi'' from public.matches where user_a = least(%L::uuid, %L::uuid) and user_b = greatest(%L::uuid, %L::uuid)',
         pg_temp.uid('friend'), pg_temp.uid('chatty'), pg_temp.uid('friend'), pg_temp.uid('chatty'), pg_temp.uid('friend')),
  'the limit is per sender'
);

-- Report rate limit: 20 per day. Blocks are unlimited.
insert into public.reports_blocks (reporter_id, target_id, type, reason)
select pg_temp.uid('me'), pg_temp.mk_user('spam' || k), 'report', 'test' from generate_series(1, 20) k;
select throws_ok(
  format('insert into public.reports_blocks (reporter_id, target_id, type) values (%L, %L, ''report'')', pg_temp.uid('me'), pg_temp.uid('friend')),
  'P0001', 'report_daily_limit_reached', 'the 21st report today is refused'
);
select lives_ok(
  format('insert into public.reports_blocks (reporter_id, target_id, type) values (%L, %L, ''block'')', pg_temp.uid('me'), pg_temp.uid('friend')),
  'blocking still works after the report limit'
);
select is(
  (select count(*)::int from public.reports_blocks where reporter_id = pg_temp.uid('me') and type = 'report'),
  20, 'exactly 20 reports were stored'
);

select * from finish();
rollback;
