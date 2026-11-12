-- Indexes specified in CLAUDE.md §6.
create index if not exists profiles_city_gender_paused_idx on public.profiles (city, gender, is_paused);
create index if not exists swipes_target_action_idx on public.swipes (target_id, action);
create index if not exists messages_match_created_idx on public.messages (match_id, created_at);
create index if not exists profiles_areas_gin_idx on public.profiles using gin (areas);

-- Supporting indexes (foreign keys without a leading-column index, and the daily like count).
create index if not exists swipes_swiper_likes_created_idx on public.swipes (swiper_id, created_at) where action = 'like';
create index if not exists matches_user_b_idx on public.matches (user_b);
create index if not exists messages_sender_idx on public.messages (sender_id);
create index if not exists reports_blocks_target_idx on public.reports_blocks (target_id);
