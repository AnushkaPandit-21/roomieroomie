// Discover data access. No React Native imports, so scripts/e2e-discover.ts uses it too.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';
import type { FeedProfile } from '@/types/domain';

import type { CardListing, CardPhoto, CardPreferences, CardProfile, CardPrompt, FeedFilters } from './types';

type Client = SupabaseClient<Database>;

export const FEED_PAGE_SIZE = 20;

export type FeedPage = { profiles: CardProfile[]; nextCursor: string | null };

export function toCardProfile(row: FeedProfile): CardProfile {
  return {
    id: row.profile_id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    city: row.city,
    areas: row.areas ?? [],
    maxBudget: row.max_budget,
    moveInDate: row.move_in_date,
    seekingType: row.seeking_type,
    occupation: row.occupation,
    bio: row.bio,
    matchScore: row.match_score,
    preferences: row.preferences as unknown as CardPreferences,
    photos: (row.photos as unknown as CardPhoto[]) ?? [],
    prompts: (row.prompts as unknown as CardPrompt[]) ?? [],
    listing: (row.listing as unknown as CardListing | null) ?? null,
  };
}

export async function fetchFeedPage(
  client: Client,
  userId: string,
  options: { cursor?: string | null; filters?: FeedFilters; limit?: number } = {},
): Promise<FeedPage> {
  const limit = options.limit ?? FEED_PAGE_SIZE;
  const f = options.filters;
  const { data, error } = await client.rpc('get_feed', {
    p_user_id: userId,
    p_limit: limit,
    p_cursor: options.cursor ?? undefined,
    p_areas: f?.areas.length ? f.areas : undefined,
    p_max_budget: f?.maxBudget ?? undefined,
    p_move_in_by: f?.moveInBy ?? undefined,
  });
  if (error) throw error;
  const rows = data ?? [];
  return {
    profiles: rows.map(toCardProfile),
    nextCursor: rows.length === limit ? rows[rows.length - 1].next_cursor : null,
  };
}

// Like a person, optionally on one of their photos/prompts with a comment.
// Returns whether this like completed a mutual like (the database trigger creates the match).
export async function sendLike(
  client: Client,
  swiperId: string,
  targetId: string,
  options: { likedItemId?: string | null; comment?: string | null } = {},
): Promise<{ matched: boolean }> {
  const comment = options.comment?.trim() || null;
  const { error } = await client.from('swipes').insert({
    swiper_id: swiperId,
    target_id: targetId,
    action: 'like',
    liked_item: options.likedItemId ?? null,
    comment,
  });
  if (error) throw error;

  const { data, error: matchError } = await client
    .from('matches')
    .select('id')
    .eq('user_a', swiperId < targetId ? swiperId : targetId)
    .eq('user_b', swiperId < targetId ? targetId : swiperId)
    .maybeSingle();
  if (matchError) throw matchError;
  return { matched: !!data };
}

export async function sendPass(client: Client, swiperId: string, targetId: string): Promise<void> {
  const { error } = await client.from('swipes').insert({ swiper_id: swiperId, target_id: targetId, action: 'pass' });
  if (error) throw error;
}

export async function touchLastActive(client: Client): Promise<void> {
  const { error } = await client.rpc('touch_last_active');
  if (error) throw error;
}

export function isDailyLimitError(error: unknown): boolean {
  return /daily_like_limit_reached/.test((error as { message?: string } | null)?.message ?? '');
}
