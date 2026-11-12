-- Discover filters (F1, approved 2026-11-13): get_feed gains three OPTIONAL narrowing filters.
--   p_areas       candidate shares at least one of these areas (incl. a host's listing area)
--   p_max_budget  candidate's budget (rent share for hosts) is at most this
--   p_move_in_by  candidate moves in on or before this date
-- With all three null the result is identical to the original get_feed.
-- Also: touch_last_active() for the "active in the last 3 days" boost (F5), and a guard so clients
-- can't set last_active_at in the future.

drop function if exists public.get_feed(uuid, integer, text);
drop function if exists public.get_feed(uuid, integer, text, text[], integer, date);

create function public.get_feed(
  p_user_id uuid,
  p_limit integer default 20,
  p_cursor text default null,
  p_areas text[] default null,
  p_max_budget integer default null,
  p_move_in_by date default null
)
returns table (
  profile_id uuid,
  name text,
  age integer,
  gender public.gender,
  city text,
  areas text[],
  max_budget integer,
  move_in_date date,
  seeking_type public.seeking_type,
  occupation text,
  bio text,
  match_score integer,   -- shown as "87% match"
  rank_score integer,    -- match_score + ranking boosts; ordering only
  next_cursor text,
  preferences jsonb,     -- lifestyle chips (dealbreakers are private and not returned)
  photos jsonb,
  prompts jsonb,
  listing jsonb          -- null unless the profile is a host with a listing
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := auth.uid();
  caller_role text := auth.role();
  page_size integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  cursor_rank integer;
  cursor_id uuid;
begin
  if p_user_id is null then
    raise exception 'get_feed: user_id is required' using errcode = '22004';
  end if;

  -- D14: a signed-in user may only load their own feed. Trusted server contexts (service role,
  -- or a direct database session with no JWT such as the SQL editor/tests) may pass any id.
  if caller is distinct from p_user_id
     and coalesce(caller_role, '') <> 'service_role'
     and not (caller is null and caller_role is null) then
    raise exception 'get_feed: you can only load your own feed' using errcode = '42501';
  end if;

  if p_cursor is not null then
    begin
      cursor_rank := split_part(p_cursor, '|', 1)::integer;
      cursor_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'get_feed: invalid cursor' using errcode = '22023';
    end;
  end if;

  return query
  with people as (
    -- Hard filter 1 (per person): same city as the caller, not paused, complete (>= 3 photos).
    select
      p.id, p.name, p.dob, p.gender, p.want_genders, p.show_to_genders, p.city, p.areas,
      p.max_budget, p.move_in_date, p.seeking_type, p.occupation, p.bio, p.last_active_at,
      l.id as listing_id,
      l.rent,
      -- D6/D7: a host's budget is their rent share (= listings.rent).
      coalesce(l.rent, p.max_budget) as eff_budget,
      array(
        select distinct lower(btrim(x))
        from unnest(p.areas || case when l.area is null then '{}'::text[] else array[l.area] end) as x
      ) as all_areas,
      pr.food, pr.smoking, pr.drinking, pr.sleep, pr.cleanliness, pr.guests, pr.pets,
      coalesce(pr.language, '{}') as language,
      coalesce(pr.dealbreakers, '{}') as dealbreakers
    from public.profiles p
    left join public.preferences pr on pr.profile_id = p.id
    left join public.listings l on l.host_id = p.id
    where p.city = (select x.city from public.profiles x where x.id = p_user_id)
      and not p.is_paused
      and (select count(*) from public.photos ph where ph.profile_id = p.id and not ph.is_room_photo) >= 3
  ),
  me as (
    select * from people where id = p_user_id
  ),
  eligible as (
    select b.*, a.id as me_id, a.seeking_type as me_seeking_type,
      a.all_areas as me_areas, a.food as me_food, a.smoking as me_smoking, a.drinking as me_drinking,
      a.eff_budget as me_eff_budget, a.sleep as me_sleep, a.cleanliness as me_cleanliness,
      a.guests as me_guests, a.pets as me_pets, a.language as me_language
    from me a
    join people b on b.id <> a.id
    where
      -- 2. Gender, two-way.
      b.gender = any (a.want_genders)
      and a.gender = any (b.show_to_genders)
      -- 3. Budget overlap (D7–D9).
      and case
        when b.listing_id is not null and a.listing_id is null then b.rent <= a.max_budget
        when a.listing_id is not null and b.listing_id is null then a.rent <= b.max_budget
        else abs(a.max_budget - b.max_budget) <= 0.30 * greatest(a.max_budget, b.max_budget)
      end
      -- 4. Move-in dates within 30 days.
      and abs(a.move_in_date - b.move_in_date) <= 30
      -- 5. No dealbreaker conflict, checked in both directions (D10).
      and not (('food' = any (a.dealbreakers) or 'food' = any (b.dealbreakers)) and a.food is distinct from b.food)
      and not (('smoking' = any (a.dealbreakers) or 'smoking' = any (b.dealbreakers)) and a.smoking is distinct from b.smoking)
      and not (('drinking' = any (a.dealbreakers) or 'drinking' = any (b.dealbreakers)) and a.drinking is distinct from b.drinking)
      and not (('sleep' = any (a.dealbreakers) or 'sleep' = any (b.dealbreakers)) and a.sleep is distinct from b.sleep)
      and not (('guests' = any (a.dealbreakers) or 'guests' = any (b.dealbreakers)) and a.guests is distinct from b.guests)
      and not (('pets' = any (a.dealbreakers) or 'pets' = any (b.dealbreakers)) and a.pets is distinct from b.pets)
      -- 6. Not already swiped by me (D13), not matched, not reported/blocked either way.
      and not exists (select 1 from public.swipes s where s.swiper_id = a.id and s.target_id = b.id)
      and not exists (
        select 1 from public.matches m
        where m.user_a = least(a.id, b.id) and m.user_b = greatest(a.id, b.id)
      )
      and not private.is_reported_or_blocked(a.id, b.id)
      -- Optional Discover filters (F1). They only narrow the result; hard filters and weights are unchanged.
      and (
        p_areas is null or cardinality(p_areas) = 0
        or exists (select 1 from unnest(p_areas) f where lower(btrim(f)) = any (b.all_areas))
      )
      and (p_max_budget is null or b.eff_budget <= p_max_budget)
      and (p_move_in_by is null or b.move_in_date <= p_move_in_by)
  ),
  scored as (
    select
      e.*,
      least(100, greatest(0, round(
        -- Area overlap: 25 (D5)
        case
          when least(cardinality(e.me_areas), cardinality(e.all_areas)) = 0 then 0
          else 25.0 * cardinality(array(select unnest(e.me_areas) intersect select unnest(e.all_areas)))
               / least(cardinality(e.me_areas), cardinality(e.all_areas))
        end
        -- Food: 15 (D3)
        + case
          when e.me_food is null or e.food is null then 0
          when e.me_food = e.food then 15
          when (e.me_food = 'veg' and e.food = 'egg') or (e.me_food = 'egg' and e.food = 'veg') then 8
          when (e.me_food = 'egg' and e.food = 'non-veg') or (e.me_food = 'non-veg' and e.food = 'egg') then 10
          else 3
        end
        -- Smoking & drinking: 20 = 10 + 10 (D1)
        + case
          when e.me_smoking is null or e.smoking is null then 0
          when e.me_smoking = e.smoking then 10
          when e.me_smoking = 'okay' or e.smoking = 'okay' then 5
          else 0
        end
        + case
          when e.me_drinking is null or e.drinking is null then 0
          when e.me_drinking = e.drinking then 10
          when e.me_drinking = 'okay' or e.drinking = 'okay' then 5
          else 0
        end
        -- Budget closeness: 15 (D6)
        + case
          when e.me_eff_budget is null or e.eff_budget is null then 0
          else 15.0 * greatest(0, 1 - abs(e.me_eff_budget - e.eff_budget)::numeric
                                   / greatest(e.me_eff_budget, e.eff_budget))
        end
        -- Sleep & cleanliness: 15 = 8 + 7 (D4)
        + case when e.me_sleep = e.sleep then 8 else 0 end
        + case when abs(e.me_cleanliness - e.cleanliness) <= 1 then 7 else 0 end
        -- Guests, pets, language: 10 = 4 + 3 + 3 (D2)
        + case when e.me_guests = e.guests then 4 else 0 end
        + case when e.me_pets = e.pets then 3 else 0 end
        + case
          when exists (
            select 1 from unnest(e.me_language) x join unnest(e.language) y on lower(x) = lower(y)
          ) then 3
          else 0
        end
      )))::integer as match_score,
      -- Ranking boosts (D11)
      (case when exists (
          select 1 from public.swipes s where s.swiper_id = e.id and s.target_id = e.me_id and s.action = 'like'
        ) then 10 else 0 end)
      + (case when e.last_active_at >= now() - interval '3 days' then 5 else 0 end)
      + (case when e.me_seeking_type = 'need_place' and e.listing_id is not null then 3 else 0 end)
        as boost
    from eligible e
  ),
  page as (
    select s.*, (s.match_score + s.boost) as rank_score
    from scored s
    where p_cursor is null
       or (s.match_score + s.boost) < cursor_rank
       or ((s.match_score + s.boost) = cursor_rank and s.id > cursor_id)
    order by (s.match_score + s.boost) desc, s.id asc
    limit page_size
  )
  select
    pg.id,
    pg.name,
    date_part('year', age(current_date, pg.dob))::integer,
    pg.gender,
    pg.city,
    pg.areas,
    pg.max_budget,
    pg.move_in_date,
    pg.seeking_type,
    pg.occupation,
    pg.bio,
    pg.match_score,
    pg.rank_score,
    pg.rank_score::text || '|' || pg.id::text,
    jsonb_build_object(
      'food', pg.food,
      'smoking', pg.smoking,
      'drinking', pg.drinking,
      'sleep', pg.sleep,
      'cleanliness', pg.cleanliness,
      'guests', pg.guests,
      'pets', pg.pets,
      'language', pg.language
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', ph.id, 'url', ph.url, 'position', ph.position) order by ph.position)
      from public.photos ph
      where ph.profile_id = pg.id and not ph.is_room_photo
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question, 'answer', q.answer, 'position', q.position) order by q.position)
      from public.prompts q
      where q.profile_id = pg.id
    ), '[]'::jsonb),
    case when pg.listing_id is null then null else (
      select jsonb_build_object(
        'id', l.id,
        'area', l.area,
        'rent', l.rent,
        'deposit', l.deposit,
        'available_from', l.available_from,
        'occupancy', l.occupancy,
        'furnished', l.furnished,
        'amenities', l.amenities,
        'room_photos', coalesce((
          select jsonb_agg(jsonb_build_object('id', ph.id, 'url', ph.url, 'position', ph.position) order by ph.position)
          from public.photos ph
          where ph.profile_id = pg.id and ph.is_room_photo
        ), '[]'::jsonb)
      )
      from public.listings l
      where l.id = pg.listing_id
    ) end
  from page pg
  order by pg.rank_score desc, pg.id asc;
end;
$$;

revoke all on function public.get_feed(uuid, integer, text, text[], integer, date) from public, anon;
grant execute on function public.get_feed(uuid, integer, text, text[], integer, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Last active (F5)
-- ---------------------------------------------------------------------------
create or replace function public.touch_last_active()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_active_at = now() where id = (select auth.uid());
$$;

revoke all on function public.touch_last_active() from public, anon;
grant execute on function public.touch_last_active() to authenticated, service_role;

-- Never in the future, so the activity boost can't be gamed by a client-supplied timestamp.
create or replace function private.clamp_last_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.last_active_at > now() then
    new.last_active_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.clamp_last_active() from public, anon, authenticated;

drop trigger if exists profiles_clamp_last_active on public.profiles;
create trigger profiles_clamp_last_active
  before insert or update of last_active_at on public.profiles
  for each row execute function private.clamp_last_active();
