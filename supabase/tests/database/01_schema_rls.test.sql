-- Every table exists, has RLS enabled and policies; anon has no access; helpers are not exposed.
begin;
create extension if not exists pgtap with schema extensions;

select plan(38);

select tables_are(
  'public',
  array['profiles', 'preferences', 'photos', 'prompts', 'listings', 'swipes', 'matches', 'messages',
        'reports_blocks', 'push_tokens'],
  'public schema has exactly the 10 specified tables'
);

select ok(c.relrowsecurity, 'RLS enabled on public.' || c.relname)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

select ok(
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = t) > 0,
  'public.' || t || ' has at least one policy'
)
from unnest(array['profiles', 'preferences', 'photos', 'prompts', 'listings', 'swipes', 'matches', 'messages',
                  'reports_blocks', 'push_tokens']) t;

select ok(
  not has_table_privilege('anon', 'public.' || t, 'select')
  and not has_table_privilege('anon', 'public.' || t, 'insert'),
  'anon cannot read or write public.' || t
)
from unnest(array['profiles', 'preferences', 'photos', 'prompts', 'listings', 'swipes', 'matches', 'messages',
                  'reports_blocks', 'push_tokens']) t;

select ok(not has_table_privilege('authenticated', 'public.matches', 'insert'), 'clients cannot insert matches');
select ok(not has_column_privilege('authenticated', 'public.matches', 'created_at', 'update'), 'clients cannot edit matches.created_at');
select ok(not has_column_privilege('authenticated', 'public.messages', 'body', 'update'), 'clients cannot edit message bodies');
select ok(not has_table_privilege('authenticated', 'public.swipes', 'update'), 'swipes are immutable');
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon cannot use the private schema');
select ok(not has_function_privilege('anon', 'public.get_feed(uuid, integer, text, text[], integer, date)', 'execute'), 'anon cannot call get_feed');
select ok(has_function_privilege('authenticated', 'public.get_feed(uuid, integer, text, text[], integer, date)', 'execute'), 'authenticated can call get_feed');

select * from finish();
rollback;
