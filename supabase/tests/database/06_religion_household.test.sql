-- Religion (shown + optional same-religion dealbreaker) and household budget (display only).
begin;
create extension if not exists pgtap with schema extensions;
\ir ../fixtures.psql

select plan(11);

select has_column('public', 'preferences', 'religion', 'preferences.religion exists');
select has_column('public', 'profiles', 'household_budget', 'profiles.household_budget exists');

-- Everyone in "me"'s feed is otherwise compatible; only religion and household budget vary.
select pg_temp.mk_user('me', '{"religion": "hindu", "household": 2000}');
select pg_temp.mk_user('hindu2', '{"religion": "hindu", "household": 9000}');
select pg_temp.mk_user('jain', '{"religion": "jain"}');
select pg_temp.mk_user('private', '{"religion": "prefer_not_to_say"}');
select pg_temp.mk_user('strict_jain', '{"religion": "jain", "dealbreakers": "{religion}"}');

-- No dealbreaker on my side: everyone except the strict Jain (who requires Jain) appears.
select set_eq(
  format('select profile_id from public.get_feed(%L)', pg_temp.uid('me')),
  format('select unnest(array[%L, %L, %L]::uuid[])', pg_temp.uid('hindu2'), pg_temp.uid('jain'), pg_temp.uid('private')),
  'religion dealbreaker is checked in both directions'
);

-- Household budget is display only: a big difference (2000 vs 9000) doesn't filter or lower the score.
select is(
  (select household_budget from public.get_feed(pg_temp.uid('me')) where profile_id = pg_temp.uid('hindu2')),
  9000, 'get_feed returns household_budget'
);
select is(
  (select match_score from public.get_feed(pg_temp.uid('me')) where profile_id = pg_temp.uid('hindu2')),
  (select match_score from public.get_feed(pg_temp.uid('me')) where profile_id = pg_temp.uid('jain')),
  'household budget and religion do not change the match %'
);
select is(
  (select preferences ->> 'religion' from public.get_feed(pg_temp.uid('me')) where profile_id = pg_temp.uid('jain')),
  'jain', 'get_feed returns religion in preferences'
);

-- With my own religion dealbreaker: only the same stated religion remains.
update public.preferences set dealbreakers = '{religion}' where profile_id = pg_temp.uid('me');
select set_eq(
  format('select profile_id from public.get_feed(%L)', pg_temp.uid('me')),
  format('select %L::uuid', pg_temp.uid('hindu2')),
  'religion dealbreaker keeps only the same religion; prefer-not-to-say never matches it'
);

-- Constraints
select throws_ok(
  format('update public.preferences set religion = ''prefer_not_to_say'' where profile_id = %L', pg_temp.uid('me')),
  '23514', null, 'a religion dealbreaker needs a stated religion'
);
select lives_ok(
  format('update public.preferences set religion = ''prefer_not_to_say'', dealbreakers = ''{}'' where profile_id = %L', pg_temp.uid('me')),
  'prefer-not-to-say is fine without the dealbreaker'
);
select throws_ok(
  format('update public.profiles set household_budget = -1 where id = %L', pg_temp.uid('me')),
  '23514', null, 'household budget cannot be negative'
);
select lives_ok(
  format('update public.profiles set household_budget = 0 where id = %L', pg_temp.uid('me')),
  'household budget can be zero'
);

select * from finish();
rollback;
