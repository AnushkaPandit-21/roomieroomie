-- Matches list, unread counts, read receipts, server-time messages, unmatch/block and get_profile.
begin;
create extension if not exists pgtap with schema extensions;
\ir ../fixtures.psql

select plan(16);

select pg_temp.mk_user('me');
select pg_temp.mk_user('ana');
select pg_temp.mk_user('bea');
select pg_temp.mk_user('cara');
select pg_temp.mk_user('stranger', '{"city": "Elsewhere"}');

-- Matches with ana, bea and cara (mutual likes; the trigger creates them).
insert into public.swipes (swiper_id, target_id, action) values
  (pg_temp.uid('ana'), pg_temp.uid('me'), 'like'), (pg_temp.uid('me'), pg_temp.uid('ana'), 'like'),
  (pg_temp.uid('bea'), pg_temp.uid('me'), 'like'), (pg_temp.uid('me'), pg_temp.uid('bea'), 'like'),
  (pg_temp.uid('cara'), pg_temp.uid('me'), 'like'), (pg_temp.uid('me'), pg_temp.uid('cara'), 'like');

create function pg_temp.match_with(label text) returns uuid language sql as $fx$
  select id from public.matches
  where user_a = least(pg_temp.uid('me'), pg_temp.uid(label)) and user_b = greatest(pg_temp.uid('me'), pg_temp.uid(label))
$fx$;
select is((select count(*)::int from public.matches where pg_temp.uid('me') in (user_a, user_b)), 3, 'three matches');

-- Ana writes two messages, then I reply to bea. Spread times so ordering is deterministic.
insert into public.messages (match_id, sender_id, body, created_at)
values (pg_temp.match_with('ana'), pg_temp.uid('ana'), 'Hi!', '2000-01-01');
select ok((select created_at > '2020-01-01' from public.messages where body = 'Hi!'), 'message time is set by the server');
insert into public.messages (match_id, sender_id, body) values (pg_temp.match_with('ana'), pg_temp.uid('ana'), 'Still looking?');
insert into public.messages (match_id, sender_id, body) values (pg_temp.match_with('bea'), pg_temp.uid('me'), 'Hey Bea');
update public.messages set created_at = now() - interval '2 hours' where body = 'Hi!';
update public.messages set created_at = now() - interval '1 hour' where body = 'Still looking?';
update public.messages set created_at = now() - interval '30 minutes' where body = 'Hey Bea';
update public.matches set created_at = now() - interval '3 hours';

select pg_temp.claims('me');
set local role authenticated;

select results_eq(
  'select profile_id from public.get_matches()',
  format('select unnest(array[%L, %L, %L]::uuid[])', pg_temp.uid('bea'), pg_temp.uid('ana'), pg_temp.uid('cara')),
  'matches are ordered by latest activity (cara has no messages: oldest activity)'
);
select is(
  (select row(last_message, unread_count, your_turn)::text from public.get_matches() where profile_id = pg_temp.uid('ana')),
  row('Still looking?', 2, true)::text, 'ana: last message, 2 unread, my turn'
);
select is(
  (select row(last_message, unread_count, your_turn)::text from public.get_matches() where profile_id = pg_temp.uid('bea')),
  row('Hey Bea', 0, false)::text, 'bea: I sent last, not my turn'
);
select ok(
  (select last_message is null and photo_url is not null from public.get_matches() where profile_id = pg_temp.uid('cara')),
  'cara is a new match (no messages) with a photo'
);
select is(public.get_unread_count(), 1, 'one conversation has unread messages');
select is((select count(*)::int from public.get_matches(1)), 1, 'page size is respected');
select results_eq(
  format('select profile_id from public.get_matches(2, %L)', (select next_cursor from public.get_matches(2) offset 1 limit 1)),
  format('select %L::uuid', pg_temp.uid('cara')),
  'the cursor continues the list'
);

-- Read receipts
select is(public.mark_match_read(pg_temp.match_with('ana')), 2, 'marking a chat read updates the other person''s messages');
select is(public.get_unread_count(), 0, 'nothing unread afterwards');
select throws_ok(
  format('select public.mark_match_read(%L)', (select id from public.matches where pg_temp.uid('me') not in (user_a, user_b) limit 1)),
  '42501', null, 'cannot mark someone else''s chat'
);

-- get_profile: matches and visible people only.
select is((select name from public.get_profile(pg_temp.uid('ana'))), 'ana', 'get_profile returns a match''s card');
select is((select count(*)::int from public.get_profile(pg_temp.uid('stranger'))), 0, 'get_profile hides people you cannot view');

-- Unmatch hides the chat; I can't message them any more.
update public.matches set unmatched_at = now() where id = pg_temp.match_with('cara');
select ok(not exists (select 1 from public.get_matches() where profile_id = pg_temp.uid('cara')), 'unmatching removes the match from the list');
select throws_ok(
  format('insert into public.messages (match_id, sender_id, body) values (%L, %L, ''hello?'')', pg_temp.match_with('cara'), pg_temp.uid('me')),
  '42501', null, 'no messages after unmatching'
);

select * from finish();
rollback;
