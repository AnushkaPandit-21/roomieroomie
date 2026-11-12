-- Row Level Security on every table (CLAUDE.md §0.2, §6).
-- Grants are reset first so each table exposes only the operations listed here; anon gets nothing.
-- Re-runnable: policies are dropped before being recreated.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on table
  public.profiles, public.preferences, public.photos, public.prompts, public.listings,
  public.swipes, public.matches, public.messages, public.reports_blocks, public.push_tokens
from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.preferences to authenticated;
grant select, insert, update, delete on public.photos to authenticated;
grant select, insert, update, delete on public.prompts to authenticated;
grant select, insert, update, delete on public.listings to authenticated;
grant select, insert on public.swipes to authenticated;
-- A5: only these columns are client-writable on matches/messages.
grant select on public.matches to authenticated;
grant update (unmatched_at) on public.matches to authenticated;
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
grant select, insert on public.reports_blocks to authenticated;
grant select, insert, delete on public.push_tokens to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.photos enable row level security;
alter table public.prompts enable row level security;
alter table public.listings enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.reports_blocks enable row level security;
alter table public.push_tokens enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (private.can_view_profile((select auth.uid()), id));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- preferences
-- ---------------------------------------------------------------------------
drop policy if exists preferences_select on public.preferences;
create policy preferences_select on public.preferences
  for select to authenticated
  using (private.can_view_profile((select auth.uid()), profile_id));

drop policy if exists preferences_insert_own on public.preferences;
create policy preferences_insert_own on public.preferences
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists preferences_update_own on public.preferences;
create policy preferences_update_own on public.preferences
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------
drop policy if exists photos_select on public.photos;
create policy photos_select on public.photos
  for select to authenticated
  using (private.can_view_profile((select auth.uid()), profile_id));

drop policy if exists photos_insert_own on public.photos;
create policy photos_insert_own on public.photos
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists photos_update_own on public.photos;
create policy photos_update_own on public.photos
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists photos_delete_own on public.photos;
create policy photos_delete_own on public.photos
  for delete to authenticated
  using (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- prompts
-- ---------------------------------------------------------------------------
drop policy if exists prompts_select on public.prompts;
create policy prompts_select on public.prompts
  for select to authenticated
  using (private.can_view_profile((select auth.uid()), profile_id));

drop policy if exists prompts_insert_own on public.prompts;
create policy prompts_insert_own on public.prompts
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists prompts_update_own on public.prompts;
create policy prompts_update_own on public.prompts
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists prompts_delete_own on public.prompts;
create policy prompts_delete_own on public.prompts
  for delete to authenticated
  using (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- listings (no address column exists, so exact addresses can never leak before a match)
-- ---------------------------------------------------------------------------
drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings
  for select to authenticated
  using (private.can_view_profile((select auth.uid()), host_id));

drop policy if exists listings_insert_own on public.listings;
create policy listings_insert_own on public.listings
  for insert to authenticated
  with check (host_id = (select auth.uid()));

drop policy if exists listings_update_own on public.listings;
create policy listings_update_own on public.listings
  for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

drop policy if exists listings_delete_own on public.listings;
create policy listings_delete_own on public.listings
  for delete to authenticated
  using (host_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- swipes
-- You see your own swipes, and likes aimed at you (Likes You). Passes are never visible
-- to the person passed on. Swipes are immutable (no update/delete).
-- ---------------------------------------------------------------------------
drop policy if exists swipes_select on public.swipes;
create policy swipes_select on public.swipes
  for select to authenticated
  using (
    swiper_id = (select auth.uid())
    or (
      target_id = (select auth.uid())
      and action = 'like'
      and not private.is_blocked((select auth.uid()), swiper_id)
    )
  );

drop policy if exists swipes_insert_own on public.swipes;
create policy swipes_insert_own on public.swipes
  for insert to authenticated
  with check (
    swiper_id = (select auth.uid())
    and private.can_view_profile((select auth.uid()), target_id)
    and not private.is_blocked((select auth.uid()), target_id)
  );

-- ---------------------------------------------------------------------------
-- matches (inserted only by the mutual-like trigger; participants may set unmatched_at once)
-- ---------------------------------------------------------------------------
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches
  for select to authenticated
  using (
    (select auth.uid()) in (user_a, user_b)
    and not private.is_blocked(user_a, user_b)
  );

drop policy if exists matches_unmatch on public.matches;
create policy matches_unmatch on public.matches
  for update to authenticated
  using ((select auth.uid()) in (user_a, user_b) and unmatched_at is null)
  with check ((select auth.uid()) in (user_a, user_b) and unmatched_at is not null);

-- ---------------------------------------------------------------------------
-- messages (only the two matched users, only while the match is active and unblocked)
-- ---------------------------------------------------------------------------
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (select auth.uid()) in (m.user_a, m.user_b)
        and m.unmatched_at is null
        and not private.is_blocked(m.user_a, m.user_b)
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and read_at is null
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (select auth.uid()) in (m.user_a, m.user_b)
        and m.unmatched_at is null
        and not private.is_blocked(m.user_a, m.user_b)
    )
  );

-- Only the recipient marks a message read.
drop policy if exists messages_mark_read on public.messages;
create policy messages_mark_read on public.messages
  for update to authenticated
  using (
    sender_id <> (select auth.uid())
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (select auth.uid()) in (m.user_a, m.user_b)
        and m.unmatched_at is null
    )
  )
  with check (sender_id <> (select auth.uid()));

-- ---------------------------------------------------------------------------
-- reports_blocks (you only ever see what you filed; nobody sees reports against them)
-- ---------------------------------------------------------------------------
drop policy if exists reports_blocks_select_own on public.reports_blocks;
create policy reports_blocks_select_own on public.reports_blocks
  for select to authenticated
  using (reporter_id = (select auth.uid()));

drop policy if exists reports_blocks_insert_own on public.reports_blocks;
create policy reports_blocks_insert_own on public.reports_blocks
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    -- Only people you have actually encountered, so arbitrary ids cannot be mass-reported.
    and (
      private.can_view_profile((select auth.uid()), target_id)
      or private.is_blocked((select auth.uid()), target_id)
      or exists (
        select 1 from public.matches m
        where m.user_a = least((select auth.uid()), target_id)
          and m.user_b = greatest((select auth.uid()), target_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- push_tokens
-- ---------------------------------------------------------------------------
drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own on public.push_tokens
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated
  using (profile_id = (select auth.uid()));
