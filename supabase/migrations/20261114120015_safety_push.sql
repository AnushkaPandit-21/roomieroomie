-- Step 9 — Notifications, safety, settings (approved 2026-11-14).
--   Auto-hide: a person reported by 3+ different people (since their last review) is hidden from
--     Discover, Rooms and Likes You until the owner clears them in the SQL editor:
--       insert into private.report_reviews (profile_id, note) values ('<id>', 'ok')
--         on conflict (profile_id) do update set cleared_at = now(), note = excluded.note;
--     private.pending_review lists everyone currently hidden, with the reasons.
--   Rate limits: messages 60/minute and 1,000/IST day per sender; reports 20/IST day per reporter.
--   Push: after-insert triggers on swipes (likes), matches and messages POST the row to the `push`
--     Edge Function via pg_net, using Vault secrets `push_webhook_url` and `push_webhook_secret`.
--     Without those secrets the triggers do nothing (local dev, tests).

-- ---------------------------------------------------------------------------
-- Auto-hide after N = 3 reports
-- ---------------------------------------------------------------------------
create table if not exists private.report_reviews (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  cleared_at timestamptz not null default now(),
  note text check (char_length(note) <= 500)
);
alter table private.report_reviews enable row level security;
revoke all on private.report_reviews from public, anon, authenticated;

create index if not exists reports_blocks_target_type_idx on public.reports_blocks (target_id, type, created_at);

create or replace function private.is_auto_hidden(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(distinct rb.reporter_id)
    from public.reports_blocks rb
    where rb.target_id = p
      and rb.type = 'report'
      and rb.created_at > coalesce((select r.cleared_at from private.report_reviews r where r.profile_id = p), '-infinity')
  ) >= 3;
$$;

revoke all on function private.is_auto_hidden(uuid) from public, anon, authenticated;

create or replace view private.pending_review as
select
  rb.target_id as profile_id,
  p.name,
  count(distinct rb.reporter_id) as reporters,
  array_agg(rb.reason order by rb.created_at) as reasons,
  max(rb.created_at) as last_report_at
from public.reports_blocks rb
join public.profiles p on p.id = rb.target_id
left join private.report_reviews r on r.profile_id = rb.target_id
where rb.type = 'report' and rb.created_at > coalesce(r.cleared_at, '-infinity')
group by rb.target_id, p.name
having count(distinct rb.reporter_id) >= 3;

revoke all on private.pending_review from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rate limits
-- ---------------------------------------------------------------------------
create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at);
create index if not exists reports_blocks_reporter_idx on public.reports_blocks (reporter_id, type, created_at);

-- Replaces step 7's trigger function: server time, then the per-sender limits. Security definer so
-- the counts include messages in chats the sender can no longer see (e.g. after an unmatch).
create or replace function private.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ist_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  new.created_at := now();
  new.read_at := null;

  perform pg_advisory_xact_lock(hashtextextended('messages:' || new.sender_id::text, 0));
  if (select count(*) from public.messages m
      where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute') >= 60 then
    raise exception 'message_rate_limit_reached' using errcode = 'P0001', hint = 'At most 60 messages a minute.';
  end if;
  if (select count(*) from public.messages m
      where m.sender_id = new.sender_id and m.created_at >= ist_day_start) >= 1000 then
    raise exception 'message_daily_limit_reached' using errcode = 'P0001', hint = 'At most 1,000 messages a day.';
  end if;
  return new;
end;
$$;

revoke all on function private.messages_before_insert() from public, anon, authenticated;

create or replace function private.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  if new.type = 'report' then
    perform pg_advisory_xact_lock(hashtextextended('reports:' || new.reporter_id::text, 0));
    if (select count(*) from public.reports_blocks rb
        where rb.reporter_id = new.reporter_id and rb.type = 'report'
          and rb.created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') >= 20 then
      raise exception 'report_daily_limit_reached' using errcode = 'P0001', hint = 'At most 20 reports a day.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.reports_before_insert() from public, anon, authenticated;

drop trigger if exists reports_blocks_before_insert on public.reports_blocks;
create trigger reports_blocks_before_insert
  before insert on public.reports_blocks
  for each row execute function private.reports_before_insert();

-- ---------------------------------------------------------------------------
-- Push webhook (database -> Edge Function `push`)
-- ---------------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;

create or replace function private.notify_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_url text;
  hook_secret text;
begin
  select ds.decrypted_secret into hook_url from vault.decrypted_secrets ds where ds.name = 'push_webhook_url';
  select ds.decrypted_secret into hook_secret from vault.decrypted_secrets ds where ds.name = 'push_webhook_secret';
  if hook_url is null or hook_secret is null then
    return null;
  end if;

  perform net.http_post(
    url := hook_url,
    body := jsonb_build_object('type', tg_table_name, 'record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', hook_secret),
    timeout_milliseconds := 5000
  );
  return null;
exception when others then
  -- A push must never block a like, match or message.
  raise warning 'notify_push failed: %', sqlerrm;
  return null;
end;
$$;

revoke all on function private.notify_push() from public, anon, authenticated;

drop trigger if exists swipes_notify_push on public.swipes;
create trigger swipes_notify_push
  after insert on public.swipes
  for each row when (new.action = 'like')
  execute function private.notify_push();

drop trigger if exists matches_notify_push on public.matches;
create trigger matches_notify_push
  after insert on public.matches
  for each row execute function private.notify_push();

drop trigger if exists messages_notify_push on public.messages;
create trigger messages_notify_push
  after insert on public.messages
  for each row execute function private.notify_push();

-- ---------------------------------------------------------------------------
-- Hidden people leave Likes You, Rooms and Discover
-- ---------------------------------------------------------------------------
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
    and not private.is_reported_or_blocked(viewer, s.swiper_id)
    and not private.is_auto_hidden(s.swiper_id);
$$;

revoke all on function private.pending_likes(uuid) from public, anon, authenticated;

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
      and not private.is_auto_hidden(h.id)
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
  household_budget integer,
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
      p.max_budget, p.household_budget, p.move_in_date, p.seeking_type, p.occupation, p.bio, p.last_active_at,
      l.id as listing_id,
      l.rent,
      -- D6/D7: a host's budget is their rent share (= listings.rent).
      coalesce(l.rent, p.max_budget) as eff_budget,
      array(
        select distinct lower(btrim(x))
        from unnest(p.areas || case when l.area is null then '{}'::text[] else array[l.area] end) as x
      ) as all_areas,
      pr.food, pr.smoking, pr.drinking, pr.sleep, pr.cleanliness, pr.guests, pr.pets, pr.religion,
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
      -- Religion (2026-11-14): same stated religion; 'prefer_not_to_say' never satisfies it.
      and not (('religion' = any (a.dealbreakers) or 'religion' = any (b.dealbreakers))
               and (a.religion is distinct from b.religion or b.religion = 'prefer_not_to_say'))
      -- 6. Not already swiped by me (D13), not matched, not reported/blocked either way.
      and not exists (select 1 from public.swipes s where s.swiper_id = a.id and s.target_id = b.id)
      and not exists (
        select 1 from public.matches m
        where m.user_a = least(a.id, b.id) and m.user_b = greatest(a.id, b.id)
      )
      and not private.is_reported_or_blocked(a.id, b.id)
      -- Reported by 3+ people and awaiting review (step 9).
      and not private.is_auto_hidden(b.id)
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
    pg.household_budget,
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
      'language', pg.language,
      'religion', pg.religion
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
