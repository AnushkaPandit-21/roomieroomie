-- Swipe rules: daily like limit (D12), liked_item validation (A3), and mutual-like => match.

-- ---------------------------------------------------------------------------
-- BEFORE INSERT: validate and rate-limit
-- ---------------------------------------------------------------------------
create or replace function private.swipes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  day_start timestamptz;
  likes_today integer;
begin
  -- Server time only, so the daily limit cannot be dodged by back-dating.
  new.created_at := now();

  if new.action = 'like' then
    -- 25 likes per India calendar day; resets at midnight Asia/Kolkata.
    -- Covers Discover likes, "Like back" and Rooms "I'm interested". Passes don't count.
    perform pg_advisory_xact_lock(hashtextextended('likes:' || new.swiper_id::text, 0));

    day_start := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';

    select count(*) into likes_today
    from public.swipes s
    where s.swiper_id = new.swiper_id
      and s.action = 'like'
      and s.created_at >= day_start;

    if likes_today >= 25 then
      raise exception 'daily_like_limit_reached'
        using errcode = 'P0001',
              detail = 'You can send up to 25 likes per day.',
              hint = 'Try again after midnight IST.';
    end if;

    if new.liked_item is not null
       and not exists (select 1 from public.photos p where p.id = new.liked_item and p.profile_id = new.target_id)
       and not exists (select 1 from public.prompts q where q.id = new.liked_item and q.profile_id = new.target_id) then
      raise exception 'liked_item must be one of the target''s photos or prompts'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists swipes_before_insert on public.swipes;
create trigger swipes_before_insert
  before insert on public.swipes
  for each row execute function private.swipes_before_insert();

-- ---------------------------------------------------------------------------
-- AFTER INSERT: create the match on a mutual like
-- The pair lock serialises two people liking each other at the same instant: whichever
-- transaction runs second waits, then (READ COMMITTED takes a fresh snapshot per statement)
-- sees the other like and creates the match. ON CONFLICT + the unique pair constraint make
-- a duplicate match impossible.
-- ---------------------------------------------------------------------------
create or replace function private.swipes_create_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.action <> 'like' then
    return null;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('match:' || least(new.swiper_id, new.target_id)::text || ':' || greatest(new.swiper_id, new.target_id)::text, 0)
  );

  if exists (
    select 1 from public.swipes s
    where s.swiper_id = new.target_id
      and s.target_id = new.swiper_id
      and s.action = 'like'
  ) then
    insert into public.matches (user_a, user_b)
    values (least(new.swiper_id, new.target_id), greatest(new.swiper_id, new.target_id))
    on conflict on constraint matches_pair_key do nothing;
  end if;

  return null;
end;
$$;

drop trigger if exists swipes_create_match on public.swipes;
create trigger swipes_create_match
  after insert on public.swipes
  for each row execute function private.swipes_create_match();

revoke all on function private.swipes_before_insert() from public, anon, authenticated;
revoke all on function private.swipes_create_match() from public, anon, authenticated;
