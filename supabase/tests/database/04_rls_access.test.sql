-- RLS behaviour as real signed-in users: profiles visibility, chat privacy, unmatch, block, reports, tokens.
begin;
create extension if not exists pgtap with schema extensions;
\ir ../fixtures.psql

select plan(22);

select pg_temp.mk_user('a');
select pg_temp.mk_user('b');
select pg_temp.mk_user('c');
select pg_temp.mk_user('m', '{"gender": "male", "want": "{male}", "show": "{male}"}');
select pg_temp.mk_user('far', '{"city": "Mumbai"}');

insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('a'), pg_temp.uid('b'), 'like');
insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('b'), pg_temp.uid('a'), 'like');
insert into public.push_tokens (profile_id, token) values (pg_temp.uid('b'), 'ExponentPushToken[b]');
select set_config('test.match', (select id::text from public.matches), false);

-- ---------------------------------------------------------------- as A
select pg_temp.claims('a');
set local role authenticated;

select is((select count(*)::int from public.profiles where id = current_setting('test.c')::uuid), 1,
  'same city + shown to my gender => visible');
select is((select count(*)::int from public.profiles where id = current_setting('test.m')::uuid), 0,
  'profile not shown to my gender is invisible');
select is((select count(*)::int from public.profiles where id = current_setting('test.far')::uuid), 0,
  'profile in another city is invisible');
select is((select count(*)::int from public.photos where profile_id = current_setting('test.m')::uuid), 0,
  'photos follow profile visibility');

select lives_ok(
  format('insert into public.messages (match_id, sender_id, body) values (%L, %L, ''Hi!'')',
         current_setting('test.match'), current_setting('test.a')),
  'a matched user can send a message'
);
select throws_ok(
  format('insert into public.messages (match_id, sender_id, body) values (%L, %L, ''Fake'')',
         current_setting('test.match'), current_setting('test.b')),
  '42501', null, 'cannot send as someone else'
);
update public.messages set read_at = now() where sender_id = current_setting('test.a')::uuid;
select is((select count(*)::int from public.messages where read_at is not null), 0, 'sender cannot mark own message read');

update public.profiles set bio = 'hacked' where id = current_setting('test.b')::uuid;
select is((select count(*)::int from public.profiles where bio = 'hacked'), 0, 'cannot edit someone else''s profile');

select throws_ok(
  format('insert into public.profiles (id, name, dob) values (%L, ''X'', ''1990-01-01'')', current_setting('test.c')),
  '42501', null, 'cannot create a profile for another user'
);
select throws_ok(
  format('update public.matches set created_at = now() where id = %L', current_setting('test.match')),
  '42501', null, 'cannot edit match columns other than unmatched_at'
);
select is((select count(*)::int from public.push_tokens), 0, 'cannot see other users'' push tokens');

-- ---------------------------------------------------------------- as C (outsider)
reset role;
select pg_temp.claims('c');
set local role authenticated;

select is((select count(*)::int from public.matches), 0, 'outsider cannot see the match');
select is((select count(*)::int from public.messages), 0, 'outsider cannot read the chat');
select throws_ok(
  format('insert into public.messages (match_id, sender_id, body) values (%L, %L, ''Intrude'')',
         current_setting('test.match'), current_setting('test.c')),
  '42501', null, 'outsider cannot post into the chat'
);
select lives_ok(
  format('insert into public.reports_blocks (reporter_id, target_id, type, reason) values (%L, %L, ''report'', ''spam'')',
         current_setting('test.c'), current_setting('test.a')),
  'a user can report someone they can see'
);
select throws_ok(
  format('insert into public.reports_blocks (reporter_id, target_id, type) values (%L, %L, ''report'')',
         current_setting('test.c'), current_setting('test.far')),
  '42501', null, 'cannot report a profile you have never been able to see'
);

-- ---------------------------------------------------------------- as B (recipient)
reset role;
select pg_temp.claims('b');
set local role authenticated;

update public.messages set read_at = now() where sender_id = current_setting('test.a')::uuid;
select is((select count(*)::int from public.messages where read_at is not null), 1, 'recipient can mark a message read');
select is((select count(*)::int from public.reports_blocks), 0, 'reports filed by others are invisible');

-- ---------------------------------------------------------------- block, then unmatch
insert into public.reports_blocks (reporter_id, target_id, type) values (current_setting('test.b')::uuid, current_setting('test.a')::uuid, 'block');
reset role;
select pg_temp.claims('a');
set local role authenticated;

select is((select count(*)::int from public.profiles where id = current_setting('test.b')::uuid), 0, 'blocked user''s profile vanishes');
select is((select count(*)::int from public.matches), 0, 'match vanishes after a block');
select is((select count(*)::int from public.messages), 0, 'chat vanishes after a block');

reset role;
delete from public.reports_blocks where type = 'block';
update public.matches set unmatched_at = now();
select pg_temp.claims('a');
set local role authenticated;
select is((select count(*)::int from public.messages), 0, 'chat is hidden after unmatch');

reset role;
select * from finish();
rollback;
