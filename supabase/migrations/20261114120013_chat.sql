-- Step 7 — Matches + chat (approved 2026-11-14).
--   messages.created_at is always server time (ordering, rate limits and "your turn" rely on it).
--   get_matches()          my active matches: other person, first photo, last message, unread count,
--                          "your turn"; newest activity first, paged.
--   get_unread_count()     conversations with unread messages (Matches tab badge).
--   mark_match_read(id)    marks the other person's messages in a match as read (server time).
--   get_profile(id)        one person's card (only if I may view them, D16), e.g. from a chat.

create or replace function private.messages_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  new.read_at := null;
  return new;
end;
$$;

revoke all on function private.messages_before_insert() from public, anon, authenticated;

drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert
  before insert on public.messages
  for each row execute function private.messages_before_insert();

-- Unread messages per match are counted often; keep it to an index scan.
create index if not exists messages_unread_idx on public.messages (match_id, sender_id) where read_at is null;

create or replace function public.get_matches(p_limit integer default 30, p_cursor text default null)
returns table (
  match_id uuid,
  profile_id uuid,
  name text,
  age integer,
  photo_url text,          -- first profile photo (storage path or seed URL)
  matched_at timestamptz,
  last_message text,       -- null for a new match with no messages yet
  last_sender_id uuid,
  last_message_at timestamptz,
  unread_count integer,
  your_turn boolean,       -- the other person sent the last message
  activity_at timestamptz, -- last message time, or match time
  next_cursor text         -- "activity_at|match_id" of this row
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  page_size integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  cursor_at timestamptz;
  cursor_id uuid;
begin
  if me is null then
    raise exception 'get_matches: sign in first' using errcode = '42501';
  end if;
  if p_cursor is not null then
    begin
      cursor_at := split_part(p_cursor, '|', 1)::timestamptz;
      cursor_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'get_matches: invalid cursor' using errcode = '22023';
    end;
  end if;

  return query
  with mine as (
    select m.id, m.created_at, case when m.user_a = me then m.user_b else m.user_a end as other
    from public.matches m
    where me in (m.user_a, m.user_b)
      and m.unmatched_at is null
      and not private.is_blocked(m.user_a, m.user_b)
  ),
  enriched as (
    select
      mi.id, mi.created_at, mi.other,
      lm.body, lm.sender_id, lm.created_at as last_at,
      coalesce(lm.created_at, mi.created_at) as activity
    from mine mi
    left join lateral (
      select msg.body, msg.sender_id, msg.created_at
      from public.messages msg
      where msg.match_id = mi.id
      order by msg.created_at desc
      limit 1
    ) lm on true
  ),
  page as (
    select e.*
    from enriched e
    where p_cursor is null
       or e.activity < cursor_at
       or (e.activity = cursor_at and e.id > cursor_id)
    order by e.activity desc, e.id asc
    limit page_size
  )
  select
    pg.id,
    p.id,
    p.name,
    date_part('year', age(current_date, p.dob))::integer,
    (select ph.url from public.photos ph
     where ph.profile_id = p.id and not ph.is_room_photo order by ph.position limit 1),
    pg.created_at,
    pg.body,
    pg.sender_id,
    pg.last_at,
    (select count(*)::integer from public.messages x
     where x.match_id = pg.id and x.sender_id <> me and x.read_at is null),
    coalesce(pg.sender_id = pg.other, false),
    pg.activity,
    pg.activity::text || '|' || pg.id::text
  from page pg
  join public.profiles p on p.id = pg.other
  order by pg.activity desc, pg.id asc;
end;
$$;

revoke all on function public.get_matches(integer, text) from public, anon;
grant execute on function public.get_matches(integer, text) to authenticated;

create or replace function public.get_unread_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct m.id)::integer
  from public.matches m
  join public.messages x on x.match_id = m.id
  where (select auth.uid()) in (m.user_a, m.user_b)
    and m.unmatched_at is null
    and not private.is_blocked(m.user_a, m.user_b)
    and x.sender_id <> (select auth.uid())
    and x.read_at is null;
$$;

revoke all on function public.get_unread_count() from public, anon;
grant execute on function public.get_unread_count() to authenticated;

create or replace function public.mark_match_read(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  n integer;
begin
  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id and me in (m.user_a, m.user_b)
      and m.unmatched_at is null and not private.is_blocked(m.user_a, m.user_b)
  ) then
    raise exception 'mark_match_read: not your match' using errcode = '42501';
  end if;

  update public.messages
  set read_at = now()
  where match_id = p_match_id and sender_id <> me and read_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.mark_match_read(uuid) from public, anon;
grant execute on function public.mark_match_read(uuid) to authenticated;

create or replace function public.get_profile(p_profile_id uuid)
returns table (
  profile_id uuid,
  name text,
  age integer,
  gender public.gender,
  city text,
  areas text[],
  max_budget integer,
  household_budget integer,
  move_in_date date,
  seeking_type public.seeking_type,
  occupation text,
  bio text,
  match_score integer,
  preferences jsonb,
  photos jsonb,
  prompts jsonb,
  listing jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.name, date_part('year', age(current_date, p.dob))::integer, p.gender, p.city, p.areas,
    p.max_budget, p.household_budget, p.move_in_date, p.seeking_type, p.occupation, p.bio,
    private.match_score((select auth.uid()), p.id),
    c -> 'preferences', c -> 'photos', c -> 'prompts', c -> 'listing'
  from public.profiles p
  cross join lateral private.profile_card(p.id) c
  where p.id = p_profile_id
    and (select auth.uid()) is not null
    and p.id <> (select auth.uid())
    and private.can_view_profile((select auth.uid()), p.id);
$$;

revoke all on function public.get_profile(uuid) from public, anon;
grant execute on function public.get_profile(uuid) to authenticated;
