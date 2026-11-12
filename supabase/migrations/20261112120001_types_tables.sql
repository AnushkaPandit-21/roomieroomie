-- RoomieRoomie: enum types and the 10 tables from CLAUDE.md §6.
-- Re-runnable: every statement is guarded (if not exists / duplicate_object).

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
do $$ begin create type public.gender as enum ('male', 'female', 'non_binary');
exception when duplicate_object then null; end $$;

do $$ begin create type public.seeking_type as enum ('need_place', 'have_place');
exception when duplicate_object then null; end $$;

do $$ begin create type public.swipe_action as enum ('like', 'pass');
exception when duplicate_object then null; end $$;

do $$ begin create type public.report_type as enum ('report', 'block');
exception when duplicate_object then null; end $$;

do $$ begin create type public.food_preference as enum ('veg', 'non-veg', 'egg');
exception when duplicate_object then null; end $$;

do $$ begin create type public.sleep_schedule as enum ('early', 'late');
exception when duplicate_object then null; end $$;

-- Smoking / drinking (D1): no = doesn't and not okay with it; okay = doesn't but okay with it; yes = does.
do $$ begin create type public.habit_preference as enum ('no', 'okay', 'yes');
exception when duplicate_object then null; end $$;

do $$ begin create type public.guests_preference as enum ('never', 'sometimes', 'often');
exception when duplicate_object then null; end $$;

do $$ begin create type public.pets_preference as enum ('has_pets', 'okay', 'no_pets');
exception when duplicate_object then null; end $$;

-- Fields that may be marked as dealbreakers (D10).
do $$ begin create type public.dealbreaker_field as enum ('food', 'smoking', 'drinking', 'sleep', 'guests', 'pets');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- Created at the "name & date of birth" onboarding step, so later fields are nullable
-- until onboarding fills them; get_feed only surfaces complete profiles.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  -- 18+ only. Safe as a CHECK because a row that passes today keeps passing as time moves on.
  dob date not null check (dob <= current_date - interval '18 years'),
  gender public.gender,
  want_genders public.gender[] not null default '{}',
  show_to_genders public.gender[] not null default '{}',
  city text,
  areas text[] not null default '{}',
  max_budget integer check (max_budget > 0),
  move_in_date date,
  seeking_type public.seeking_type,
  occupation text check (char_length(occupation) <= 80),
  bio text check (char_length(bio) <= 500),
  is_paused boolean not null default false,
  last_active_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- preferences (dealbreakers = fields that must match exactly)
-- ---------------------------------------------------------------------------
create table if not exists public.preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  food public.food_preference,
  smoking public.habit_preference,
  drinking public.habit_preference,
  sleep public.sleep_schedule,
  cleanliness smallint check (cleanliness between 1 and 5),
  guests public.guests_preference,
  pets public.pets_preference,
  language text[] not null default '{}',
  dealbreakers public.dealbreaker_field[] not null default '{}'
);

-- ---------------------------------------------------------------------------
-- photos (profile photos and, with is_room_photo = true, listing room photos — A2)
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  url text not null check (char_length(url) between 1 and 1024),
  position smallint not null check (position >= 0),
  is_room_photo boolean not null default false,
  -- Deferred so the app can swap positions when reordering inside one transaction.
  constraint photos_profile_position_key unique (profile_id, is_room_photo, position) deferrable initially deferred
);

-- ---------------------------------------------------------------------------
-- prompts (3 per profile: positions 1..3, unique per profile)
-- ---------------------------------------------------------------------------
create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 150),
  answer text not null check (char_length(btrim(answer)) between 1 and 300),
  position smallint not null check (position between 1 and 3),
  constraint prompts_profile_position_key unique (profile_id, position) deferrable initially deferred
);

-- ---------------------------------------------------------------------------
-- listings (only for have_place users; one per host — A4; no address column by design)
-- rent = monthly amount the incoming roommate pays, i.e. the rent share (D7).
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null unique references public.profiles (id) on delete cascade,
  area text not null check (char_length(btrim(area)) between 1 and 80),
  rent integer not null check (rent > 0),
  deposit integer check (deposit >= 0),
  available_from date not null,
  occupancy smallint check (occupancy between 1 and 20),
  furnished boolean,
  amenities text[] not null default '{}'
);

-- ---------------------------------------------------------------------------
-- swipes (unique on (swiper, target))
-- liked_item = id of one of the target's photos or prompts; validated by trigger (A3).
-- ---------------------------------------------------------------------------
create table if not exists public.swipes (
  swiper_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  action public.swipe_action not null,
  liked_item uuid,
  comment text check (char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  primary key (swiper_id, target_id),
  constraint swipes_not_self check (swiper_id <> target_id),
  constraint swipes_pass_has_no_payload check (action = 'like' or (liked_item is null and comment is null))
);

-- ---------------------------------------------------------------------------
-- matches (created only by the mutual-like trigger)
-- Pair stored in canonical order + unique => a pair can never be matched twice.
-- ---------------------------------------------------------------------------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unmatched_at timestamptz,
  constraint matches_ordered_pair check (user_a < user_b),
  constraint matches_pair_key unique (user_a, user_b)
);

-- ---------------------------------------------------------------------------
-- messages (realtime-subscribed per match)
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- ---------------------------------------------------------------------------
-- reports_blocks (id + created_at added per A1)
-- ---------------------------------------------------------------------------
create table if not exists public.reports_blocks (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  type public.report_type not null,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  constraint reports_blocks_not_self check (reporter_id <> target_id),
  constraint reports_blocks_once_key unique (reporter_id, target_id, type)
);

-- ---------------------------------------------------------------------------
-- push_tokens
-- ---------------------------------------------------------------------------
create table if not exists public.push_tokens (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token text not null check (char_length(token) between 1 and 512),
  primary key (profile_id, token)
);
