-- Helper functions used by RLS policies, triggers and get_feed.
-- They live in schema `private`, which is NOT exposed through the Data API, so clients cannot
-- call them directly (e.g. to probe whether two strangers have matched or blocked each other).
-- SECURITY DEFINER so policies can consult other tables without recursive RLS checks;
-- search_path is pinned to '' and every object is schema-qualified.

create schema if not exists private;
revoke all on schema private from public, anon;
-- RLS policies run as the requesting role, which therefore needs to reach these helpers.
grant usage on schema private to authenticated, service_role;

-- True if either user has blocked the other. Blocked users vanish from each other everywhere.
create or replace function private.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reports_blocks rb
    where rb.type = 'block'
      and ((rb.reporter_id = a and rb.target_id = b) or (rb.reporter_id = b and rb.target_id = a))
  );
$$;

-- True if either user has reported or blocked the other (feed hard filter 6).
create or replace function private.is_reported_or_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reports_blocks rb
    where (rb.reporter_id = a and rb.target_id = b) or (rb.reporter_id = b and rb.target_id = a)
  );
$$;

-- Complete = at least 3 non-room photos (CLAUDE.md §6, §7 filter 1).
create or replace function private.is_profile_complete(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.photos ph where ph.profile_id = p and not ph.is_room_photo) >= 3;
$$;

-- Active (not unmatched) match between two users.
create or replace function private.has_active_match(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    where m.user_a = least(a, b) and m.user_b = greatest(a, b) and m.unmatched_at is null
  );
$$;

-- D16: who may read whose profile (and its preferences, photos, prompts, listing).
-- Never if blocked. Otherwise: yourself; an active match; someone who liked you;
-- or same city, not paused, and your gender is in their show_to_genders.
create or replace function private.can_view_profile(viewer uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    viewer is not null
    and target is not null
    and (
      viewer = target
      or (
        not private.is_blocked(viewer, target)
        and (
          private.has_active_match(viewer, target)
          or exists (
            select 1 from public.swipes s
            where s.swiper_id = target and s.target_id = viewer and s.action = 'like'
          )
          or exists (
            select 1
            from public.profiles t
            join public.profiles v on v.id = viewer
            where t.id = target
              and not t.is_paused
              and t.city = v.city
              and v.gender = any (t.show_to_genders)
          )
        )
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- Onboarding allows 3–6 profile photos; cap non-room photos at 6.
create or replace function private.photos_enforce_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_room_photo
     and (tg_op = 'INSERT' or old.is_room_photo or old.profile_id <> new.profile_id) then
    -- Serialise concurrent uploads for the same profile so the cap cannot be raced.
    perform pg_advisory_xact_lock(hashtextextended('photos:' || new.profile_id::text, 0));
    if (select count(*) from public.photos p
        where p.profile_id = new.profile_id and not p.is_room_photo and p.id <> new.id) >= 6 then
      raise exception 'A profile can have at most 6 photos' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists photos_enforce_limit on public.photos;
create trigger photos_enforce_limit
  before insert or update of is_room_photo, profile_id on public.photos
  for each row execute function private.photos_enforce_limit();

-- Listings and room photos are only for have_place users.
create or replace function private.require_have_place()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  if tg_table_name = 'listings' then
    owner_id := new.host_id;
  elsif new.is_room_photo then
    owner_id := new.profile_id;
  else
    return new;
  end if;

  if not exists (select 1 from public.profiles p where p.id = owner_id and p.seeking_type = 'have_place') then
    raise exception 'Only users who have a place can add a listing or room photos' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_require_have_place on public.listings;
create trigger listings_require_have_place
  before insert or update of host_id on public.listings
  for each row execute function private.require_have_place();

drop trigger if exists photos_require_have_place on public.photos;
create trigger photos_require_have_place
  before insert or update of is_room_photo, profile_id on public.photos
  for each row execute function private.require_have_place();

revoke all on all functions in schema private from public, anon;
grant execute on function private.is_blocked(uuid, uuid) to authenticated, service_role;
grant execute on function private.is_reported_or_blocked(uuid, uuid) to authenticated, service_role;
grant execute on function private.is_profile_complete(uuid) to authenticated, service_role;
grant execute on function private.has_active_match(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_view_profile(uuid, uuid) to authenticated, service_role;
