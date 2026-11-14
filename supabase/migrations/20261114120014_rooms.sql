-- Step 8 — Rooms (approved 2026-11-14).
-- get_rooms(): hosts with a listing in my city, as cards (listing + room photos + host profile).
--   Applies: same city, host not paused and complete, two-way gender rule, dealbreakers in both
--   directions (D10 + religion), not blocked/reported either way, not already liked/crossed by me
--   (D13) or matched, not me. Budget and move-in hard filters are NOT applied; Rooms is a browse
--   view narrowed by the optional filters instead:
--     p_areas          listing area is one of these (case-insensitive)
--     p_max_rent       listing rent (= rent share, D7) at most this
--     p_available_by   listing available on or before this date
--   Ordered by match % (private.match_score), then host id. Cursor = "score|host_id".
-- "I'm interested" is an ordinary like on the host (swipes), so the daily limit and match trigger apply.

create or replace function private.dealbreakers_ok(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      not (('food' = any (x.dealbreakers) or 'food' = any (y.dealbreakers)) and x.food is distinct from y.food)
      and not (('smoking' = any (x.dealbreakers) or 'smoking' = any (y.dealbreakers)) and x.smoking is distinct from y.smoking)
      and not (('drinking' = any (x.dealbreakers) or 'drinking' = any (y.dealbreakers)) and x.drinking is distinct from y.drinking)
      and not (('sleep' = any (x.dealbreakers) or 'sleep' = any (y.dealbreakers)) and x.sleep is distinct from y.sleep)
      and not (('guests' = any (x.dealbreakers) or 'guests' = any (y.dealbreakers)) and x.guests is distinct from y.guests)
      and not (('pets' = any (x.dealbreakers) or 'pets' = any (y.dealbreakers)) and x.pets is distinct from y.pets)
      and not (('religion' = any (x.dealbreakers) or 'religion' = any (y.dealbreakers))
               and (x.religion is distinct from y.religion or y.religion = 'prefer_not_to_say'))
    from public.preferences x, public.preferences y
    where x.profile_id = a and y.profile_id = b
  ), true);
$$;

revoke all on function private.dealbreakers_ok(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_rooms(
  p_limit integer default 20,
  p_cursor text default null,
  p_areas text[] default null,
  p_max_rent integer default null,
  p_available_by date default null
)
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
  next_cursor text,
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
  cursor_score integer;
  cursor_id uuid;
begin
  if me is null then
    raise exception 'get_rooms: sign in first' using errcode = '42501';
  end if;
  if p_cursor is not null then
    begin
      cursor_score := split_part(p_cursor, '|', 1)::integer;
      cursor_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'get_rooms: invalid cursor' using errcode = '22023';
    end;
  end if;

  return query
  with me_row as (
    select p.* from public.profiles p where p.id = me
  ),
  hosts as (
    select h.id, private.match_score(me, h.id) as score
    from public.listings l
    join public.profiles h on h.id = l.host_id
    cross join me_row m
    where h.id <> me
      and h.city = m.city
      and not h.is_paused
      and private.is_profile_complete(h.id)
      and h.gender = any (m.want_genders)
      and m.gender = any (h.show_to_genders)
      and private.dealbreakers_ok(me, h.id)
      and not private.is_reported_or_blocked(me, h.id)
      and not exists (select 1 from public.swipes s where s.swiper_id = me and s.target_id = h.id)
      and not exists (
        select 1 from public.matches x where x.user_a = least(me, h.id) and x.user_b = greatest(me, h.id)
      )
      and (p_areas is null or cardinality(p_areas) = 0
           or lower(btrim(l.area)) in (select lower(btrim(f)) from unnest(p_areas) f))
      and (p_max_rent is null or l.rent <= p_max_rent)
      and (p_available_by is null or l.available_from <= p_available_by)
  ),
  page as (
    select hs.*
    from hosts hs
    where p_cursor is null
       or hs.score < cursor_score
       or (hs.score = cursor_score and hs.id > cursor_id)
    order by hs.score desc, hs.id asc
    limit page_size
  )
  select
    p.id, p.name, date_part('year', age(current_date, p.dob))::integer, p.gender, p.city, p.areas,
    p.max_budget, p.household_budget, p.move_in_date, p.seeking_type, p.occupation, p.bio,
    pg.score,
    pg.score::text || '|' || p.id::text,
    c -> 'preferences', c -> 'photos', c -> 'prompts', c -> 'listing'
  from page pg
  join public.profiles p on p.id = pg.id
  cross join lateral private.profile_card(p.id) c
  order by pg.score desc, p.id asc;
end;
$$;

revoke all on function public.get_rooms(integer, text, text[], integer, date) from public, anon;
grant execute on function public.get_rooms(integer, text, text[], integer, date) to authenticated;

-- Rooms filters by city + listing; hosts are found through listings, so index the join/filters.
create index if not exists listings_available_from_idx on public.listings (available_from);
