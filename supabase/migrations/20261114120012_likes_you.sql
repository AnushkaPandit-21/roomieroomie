-- Step 6 — Likes You (approved 2026-11-14).
--   private.match_score(a, b)   the get_feed compatibility score (D1–D6) for any pair, so Likes You,
--                               Rooms and Matches show the same "87% match" as Discover. get_feed keeps
--                               its own inline copy; a pgTAP test asserts the two always agree.
--   private.profile_card(p)     preferences / photos / prompts / listing JSON in get_feed's shape.
--   get_likes_you()             people who liked me that I haven't answered yet, newest first, paged.
--   get_likes_you_count()       badge count for the tab.

create or replace function private.match_score(a uuid, b uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select
      p.id,
      coalesce(l.rent, p.max_budget) as eff_budget,
      array(
        select distinct lower(btrim(x))
        from unnest(p.areas || case when l.area is null then '{}'::text[] else array[l.area] end) as x
      ) as all_areas,
      pr.food, pr.smoking, pr.drinking, pr.sleep, pr.cleanliness, pr.guests, pr.pets,
      coalesce(pr.language, '{}') as language
    from public.profiles p
    left join public.preferences pr on pr.profile_id = p.id
    left join public.listings l on l.host_id = p.id
    where p.id in (a, b)
  )
  select least(100, greatest(0, round(
    -- Area overlap: 25 (D5)
    case
      when least(cardinality(x.all_areas), cardinality(y.all_areas)) = 0 then 0
      else 25.0 * cardinality(array(select unnest(x.all_areas) intersect select unnest(y.all_areas)))
           / least(cardinality(x.all_areas), cardinality(y.all_areas))
    end
    -- Food: 15 (D3)
    + case
      when x.food is null or y.food is null then 0
      when x.food = y.food then 15
      when (x.food = 'veg' and y.food = 'egg') or (x.food = 'egg' and y.food = 'veg') then 8
      when (x.food = 'egg' and y.food = 'non-veg') or (x.food = 'non-veg' and y.food = 'egg') then 10
      else 3
    end
    -- Smoking & drinking: 20 = 10 + 10 (D1)
    + case
      when x.smoking is null or y.smoking is null then 0
      when x.smoking = y.smoking then 10
      when x.smoking = 'okay' or y.smoking = 'okay' then 5
      else 0
    end
    + case
      when x.drinking is null or y.drinking is null then 0
      when x.drinking = y.drinking then 10
      when x.drinking = 'okay' or y.drinking = 'okay' then 5
      else 0
    end
    -- Budget closeness: 15 (D6)
    + case
      when x.eff_budget is null or y.eff_budget is null then 0
      else 15.0 * greatest(0, 1 - abs(x.eff_budget - y.eff_budget)::numeric / greatest(x.eff_budget, y.eff_budget))
    end
    -- Sleep & cleanliness: 15 = 8 + 7 (D4)
    + case when x.sleep = y.sleep then 8 else 0 end
    + case when abs(x.cleanliness - y.cleanliness) <= 1 then 7 else 0 end
    -- Guests, pets, language: 10 = 4 + 3 + 3 (D2)
    + case when x.guests = y.guests then 4 else 0 end
    + case when x.pets = y.pets then 3 else 0 end
    + case
      when exists (select 1 from unnest(x.language) l1 join unnest(y.language) l2 on lower(l1) = lower(l2)) then 3
      else 0
    end
  )))::integer
  from people x, people y
  where x.id = a and y.id = b;
$$;

revoke all on function private.match_score(uuid, uuid) from public, anon, authenticated;

-- Card JSON for one profile, in get_feed's shape (dealbreakers stay private).
create or replace function private.profile_card(p uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'preferences', (
      select jsonb_build_object(
        'food', pr.food, 'smoking', pr.smoking, 'drinking', pr.drinking, 'sleep', pr.sleep,
        'cleanliness', pr.cleanliness, 'guests', pr.guests, 'pets', pr.pets,
        'language', coalesce(pr.language, '{}'), 'religion', pr.religion
      )
      from public.preferences pr where pr.profile_id = p
    ),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object('id', ph.id, 'url', ph.url, 'position', ph.position) order by ph.position)
      from public.photos ph where ph.profile_id = p and not ph.is_room_photo
    ), '[]'::jsonb),
    'prompts', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question, 'answer', q.answer, 'position', q.position) order by q.position)
      from public.prompts q where q.profile_id = p
    ), '[]'::jsonb),
    'listing', (
      select jsonb_build_object(
        'id', l.id, 'area', l.area, 'rent', l.rent, 'deposit', l.deposit, 'available_from', l.available_from,
        'occupancy', l.occupancy, 'furnished', l.furnished, 'amenities', l.amenities,
        'room_photos', coalesce((
          select jsonb_agg(jsonb_build_object('id', ph.id, 'url', ph.url, 'position', ph.position) order by ph.position)
          from public.photos ph where ph.profile_id = p and ph.is_room_photo
        ), '[]'::jsonb)
      )
      from public.listings l where l.host_id = p
    )
  );
$$;

revoke all on function private.profile_card(uuid) from public, anon, authenticated;

-- Likes waiting for my answer: not paused, complete, not blocked/reported either way, and I haven't
-- liked or crossed them yet (which also excludes anyone I've matched with).
create or replace function private.pending_likes(viewer uuid)
returns table (swiper_id uuid, liked_item uuid, comment text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.swiper_id, s.liked_item, s.comment, s.created_at
  from public.swipes s
  join public.profiles p on p.id = s.swiper_id
  where s.target_id = viewer
    and s.action = 'like'
    and not p.is_paused
    and private.is_profile_complete(p.id)
    and not exists (select 1 from public.swipes mine where mine.swiper_id = viewer and mine.target_id = s.swiper_id)
    and not private.is_reported_or_blocked(viewer, s.swiper_id);
$$;

revoke all on function private.pending_likes(uuid) from public, anon, authenticated;

create or replace function public.get_likes_you(p_limit integer default 20, p_cursor text default null)
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
  liked_item uuid,       -- one of MY photos/prompts, or null for a plain like
  comment text,
  liked_at timestamptz,
  next_cursor text,      -- "liked_at|profile_id" of this row
  preferences jsonb,
  photos jsonb,
  prompts jsonb,
  listing jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  page_size integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  cursor_at timestamptz;
  cursor_id uuid;
begin
  if me is null then
    raise exception 'get_likes_you: sign in first' using errcode = '42501';
  end if;
  if p_cursor is not null then
    begin
      cursor_at := split_part(p_cursor, '|', 1)::timestamptz;
      cursor_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'get_likes_you: invalid cursor' using errcode = '22023';
    end;
  end if;

  return query
  with page as (
    select l.*
    from private.pending_likes(me) l
    where p_cursor is null
       or l.created_at < cursor_at
       or (l.created_at = cursor_at and l.swiper_id > cursor_id)
    order by l.created_at desc, l.swiper_id asc
    limit page_size
  )
  select
    p.id, p.name, date_part('year', age(current_date, p.dob))::integer, p.gender, p.city, p.areas,
    p.max_budget, p.household_budget, p.move_in_date, p.seeking_type, p.occupation, p.bio,
    private.match_score(me, p.id),
    pg.liked_item, pg.comment, pg.created_at,
    pg.created_at::text || '|' || p.id::text,
    c -> 'preferences', c -> 'photos', c -> 'prompts', c -> 'listing'
  from page pg
  join public.profiles p on p.id = pg.swiper_id
  cross join lateral private.profile_card(p.id) c
  order by pg.created_at desc, p.id asc;
end;
$$;

revoke all on function public.get_likes_you(integer, text) from public, anon;
grant execute on function public.get_likes_you(integer, text) to authenticated;

create or replace function public.get_likes_you_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from private.pending_likes((select auth.uid()));
$$;

revoke all on function public.get_likes_you_count() from public, anon;
grant execute on function public.get_likes_you_count() to authenticated;
