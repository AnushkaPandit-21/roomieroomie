// Likes You data access. No React Native imports, so the e2e scripts use it too.
import type { SupabaseClient } from '@supabase/supabase-js';

import { toCardProfile } from '@/features/feed/api';
import type { Database } from '@/types/database';

import type { LikesYouPage } from './types';

type Client = SupabaseClient<Database>;

export const LIKES_PAGE_SIZE = 20;

// People who liked me and are waiting for an answer, newest first (get_likes_you).
export async function fetchLikesYouPage(
  client: Client,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<LikesYouPage> {
  const limit = options.limit ?? LIKES_PAGE_SIZE;
  const { data, error } = await client.rpc('get_likes_you', { p_limit: limit, p_cursor: options.cursor ?? undefined });
  if (error) throw error;
  const rows = data ?? [];
  return {
    likes: rows.map((row) => ({
      profile: toCardProfile(row),
      likedItemId: row.liked_item,
      comment: row.comment,
      likedAt: row.liked_at,
    })),
    nextCursor: rows.length === limit ? rows[rows.length - 1].next_cursor : null,
  };
}

export async function fetchLikesYouCount(client: Client): Promise<number> {
  const { data, error } = await client.rpc('get_likes_you_count');
  if (error) throw error;
  return data ?? 0;
}

// DEV ONLY: makes up to `count` test (seed) profiles in my city like me, to test Likes You -> chat.
// Does nothing in a project without seed data.
export async function devSeedLikes(client: Client, count = 5): Promise<number> {
  const { data, error } = await client.rpc('dev_seed_likes', { p_count: count });
  if (error) throw error;
  return data ?? 0;
}
