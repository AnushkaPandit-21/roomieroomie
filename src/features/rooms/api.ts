// Rooms data access. No React Native imports, so the e2e scripts use it too.
import type { SupabaseClient } from '@supabase/supabase-js';

import { sendLike, toCardProfile } from '@/features/feed/api';
import type { CardProfile, FeedFilters } from '@/features/feed/types';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

export const ROOMS_PAGE_SIZE = 20;

export type RoomsPage = { rooms: CardProfile[]; nextCursor: string | null };

// Hosts with a room (get_rooms). Filters reuse FeedFilters: maxBudget = max rent, moveInBy = available by.
export async function fetchRoomsPage(
  client: Client,
  options: { cursor?: string | null; filters?: FeedFilters; limit?: number } = {},
): Promise<RoomsPage> {
  const limit = options.limit ?? ROOMS_PAGE_SIZE;
  const f = options.filters;
  const { data, error } = await client.rpc('get_rooms', {
    p_limit: limit,
    p_cursor: options.cursor ?? undefined,
    p_areas: f?.areas.length ? f.areas : undefined,
    p_max_rent: f?.maxBudget ?? undefined,
    p_available_by: f?.moveInBy ?? undefined,
  });
  if (error) throw error;
  const rows = data ?? [];
  return {
    rooms: rows.map(toCardProfile),
    nextCursor: rows.length === limit ? rows[rows.length - 1].next_cursor : null,
  };
}

// "I'm interested" counts as a like on the host (same daily limit and match trigger), on their
// first room photo so their Likes You says "Interested in your room".
export function sendInterest(client: Client, userId: string, host: CardProfile, note?: string | null) {
  return sendLike(client, userId, host.id, {
    likedItemId: host.listing?.room_photos[0]?.id ?? null,
    comment: note,
  });
}
