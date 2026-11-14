-- DEV ONLY (owner request 2026-11-14): dev_seed_likes() makes up to N seed (test) profiles in my city
-- like me, so Likes You -> like back -> Matches -> chat can be tested without a second phone.
--   * Only seed users (auth.users.raw_app_meta_data.seed = true, D17) ever send these likes.
--     Production has no seed users, so there it does nothing (returns 0).
--   * The app shows the button only in development builds (__DEV__).
--   * Likes go through the normal swipes insert (triggers, daily limit, push webhook).
--   * People I've already liked/crossed, or blocked/reported either way, are skipped; people
--     whose gender I want come first.

create or replace function public.dev_seed_likes(p_count integer default 5)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_city text;
  my_want public.gender[];
  sent integer := 0;
  r record;
  comments text[] := array[
    'Hi! Are you still looking for a flatmate?', null, 'Your profile sounds like a great fit.',
    'We seem to have similar routines. Want to chat?', null, 'Love your answers! When are you moving?'
  ];
begin
  if me is null then
    raise exception 'dev_seed_likes: sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from auth.users u where u.id = me and u.raw_app_meta_data ->> 'seed' = 'true') then
    raise exception 'dev_seed_likes: not for seed users' using errcode = '42501';
  end if;

  select p.city, p.want_genders into my_city, my_want from public.profiles p where p.id = me;
  if my_city is null then
    raise exception 'dev_seed_likes: complete your profile first' using errcode = 'P0001';
  end if;

  for r in
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.raw_app_meta_data ->> 'seed' = 'true'
      and p.city = my_city
      and not exists (select 1 from public.swipes s where s.swiper_id = p.id and s.target_id = me)
      and not exists (select 1 from public.swipes s where s.swiper_id = me and s.target_id = p.id)
      and not private.is_reported_or_blocked(me, p.id)
    order by (p.gender = any (my_want)) desc, random()
    limit least(greatest(coalesce(p_count, 5), 1), 20)
  loop
    insert into public.swipes (swiper_id, target_id, action, comment)
    values (r.id, me, 'like', comments[1 + sent % array_length(comments, 1)]);
    sent := sent + 1;
  end loop;

  return sent;
end;
$$;

revoke all on function public.dev_seed_likes(integer) from public, anon;
grant execute on function public.dev_seed_likes(integer) to authenticated;
