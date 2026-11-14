-- dev_seed_likes: only seed users like me, they show in Likes You, and liking back makes a match.
begin;
create extension if not exists pgtap with schema extensions;
\ir ../fixtures.psql

select plan(7);

select pg_temp.mk_user('me');
select pg_temp.mk_user('seed_a');
select pg_temp.mk_user('seed_b', '{"gender": "male", "show": "{female,male}"}');
select pg_temp.mk_user('seed_far', '{"city": "Elsewhere"}');
select pg_temp.mk_user('real_person');
update auth.users set raw_app_meta_data = '{"seed": true}'
where id in (pg_temp.uid('seed_a'), pg_temp.uid('seed_b'), pg_temp.uid('seed_far'));

select pg_temp.claims('me');
set local role authenticated;

select is(public.dev_seed_likes(10), 2, 'every seed user in my city likes me (not other cities, never real users)');
select set_eq(
  'select profile_id from public.get_likes_you()',
  format('select unnest(array[%L, %L]::uuid[])', pg_temp.uid('seed_a'), pg_temp.uid('seed_b')),
  'they appear in Likes You'
);
select is(public.dev_seed_likes(10), 0, 'running it again adds nobody new');

insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('me'), pg_temp.uid('seed_a'), 'like');
select ok(
  exists (select 1 from public.get_matches() where profile_id = pg_temp.uid('seed_a')),
  'liking one back moves them to Matches'
);
select lives_ok(
  format('insert into public.messages (match_id, sender_id, body) select match_id, %L, ''Hi!'' from public.get_matches() where profile_id = %L',
         pg_temp.uid('me'), pg_temp.uid('seed_a')),
  'and I can message them'
);

reset role;
select pg_temp.claims('seed_a');
set local role authenticated;
select throws_ok('select public.dev_seed_likes()', '42501', null, 'seed users cannot call it');
reset role;
select ok(not has_function_privilege('anon', 'public.dev_seed_likes(integer)', 'execute'), 'anon cannot call it');

select * from finish();
rollback;
