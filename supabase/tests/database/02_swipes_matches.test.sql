-- Mutual-like trigger, duplicate-match protection, daily like limit and liked_item validation.
begin;
create extension if not exists pgtap with schema extensions;
\ir ../fixtures.psql

select plan(16);

select pg_temp.mk_user('a');
select pg_temp.mk_user('b');
select pg_temp.mk_user('c');

-- ---------------------------------------------------------------- match trigger
insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('a'), pg_temp.uid('b'), 'like');
select is((select count(*)::int from public.matches), 0, 'one-sided like creates no match');

insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('b'), pg_temp.uid('a'), 'like');
select is((select count(*)::int from public.matches), 1, 'mutual like creates exactly one match');
select ok(
  (select user_a = least(pg_temp.uid('a'), pg_temp.uid('b')) and user_b = greatest(pg_temp.uid('a'), pg_temp.uid('b'))
   from public.matches),
  'match pair is stored in canonical order'
);

select throws_ok(
  format('insert into public.swipes (swiper_id, target_id, action) values (%L, %L, ''like'')', pg_temp.uid('a'), pg_temp.uid('b')),
  '23505', null, 'a pair can only be swiped once'
);
select throws_ok(
  format('insert into public.matches (user_a, user_b) values (%L, %L)',
         least(pg_temp.uid('a'), pg_temp.uid('b')), greatest(pg_temp.uid('a'), pg_temp.uid('b'))),
  '23505', null, 'duplicate match is rejected by the unique pair constraint'
);
select throws_ok(
  format('insert into public.matches (user_a, user_b) values (%L, %L)',
         greatest(pg_temp.uid('a'), pg_temp.uid('b')), least(pg_temp.uid('a'), pg_temp.uid('b'))),
  '23514', null, 'reverse-ordered duplicate is rejected by the ordering check'
);

-- A pass never creates a match and stays invisible to its target.
insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('c'), pg_temp.uid('a'), 'pass');
insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('a'), pg_temp.uid('c'), 'like');
select is((select count(*)::int from public.matches), 1, 'like + pass creates no match');

select pg_temp.claims('a');
set local role authenticated;
select is(
  (select count(*)::int from public.swipes where swiper_id = current_setting('test.c')::uuid),
  0, 'the person passed on cannot see the pass'
);
select is(
  (select count(*)::int from public.swipes where swiper_id = current_setting('test.b')::uuid),
  1, 'likes aimed at you are visible (Likes You)'
);
select throws_ok(
  format('insert into public.matches (user_a, user_b) values (%L, %L)', gen_random_uuid(), gen_random_uuid()),
  '42501', null, 'clients cannot insert matches directly'
);
reset role;

-- ---------------------------------------------------------------- liked_item + timestamps
select throws_ok(
  format('insert into public.swipes (swiper_id, target_id, action, liked_item) values (%L, %L, ''like'', %L)',
         pg_temp.uid('b'), pg_temp.uid('c'), gen_random_uuid()),
  '23514', null, 'liked_item must belong to the target'
);
select lives_ok(
  format('insert into public.swipes (swiper_id, target_id, action, liked_item, comment, created_at)
          values (%L, %L, ''like'', (select id from public.photos where profile_id = %L limit 1), ''Nice!'', ''2000-01-01'')',
         pg_temp.uid('b'), pg_temp.uid('c'), pg_temp.uid('c')),
  'liking a specific photo with a comment works'
);
select ok(
  (select created_at > now() - interval '1 minute' from public.swipes
   where swiper_id = pg_temp.uid('b') and target_id = pg_temp.uid('c')),
  'client-supplied created_at is overridden with server time'
);

-- ---------------------------------------------------------------- 25 likes/day
select pg_temp.mk_user('liker');
do $$
begin
  for k in 1..26 loop
    perform pg_temp.mk_user('t' || k);
  end loop;
  -- 'liker' already has 0 likes; send 25.
  for k in 1..25 loop
    insert into public.swipes (swiper_id, target_id, action) values (pg_temp.uid('liker'), pg_temp.uid('t' || k), 'like');
  end loop;
end;
$$;

select is(
  (select count(*)::int from public.swipes where swiper_id = pg_temp.uid('liker') and action = 'like'),
  25, '25 likes in a day are allowed'
);
select throws_ok(
  format('insert into public.swipes (swiper_id, target_id, action) values (%L, %L, ''like'')',
         pg_temp.uid('liker'), pg_temp.uid('t26')),
  'P0001', 'daily_like_limit_reached', 'the 26th like in a day is rejected'
);
select lives_ok(
  format('insert into public.swipes (swiper_id, target_id, action) values (%L, %L, ''pass'')',
         pg_temp.uid('liker'), pg_temp.uid('t26')),
  'passes are not limited'
);

select * from finish();
rollback;
