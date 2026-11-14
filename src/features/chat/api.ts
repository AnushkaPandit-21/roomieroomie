// Matches + chat data access. No React Native imports, so the e2e scripts use it too.
import type { SupabaseClient } from '@supabase/supabase-js';

import { toCardProfile } from '@/features/feed/api';
import type { CardProfile } from '@/features/feed/types';
import type { Database } from '@/types/database';

import type { ChatMessage, MatchSummary, MatchesPage, MessagesPage } from './types';

type Client = SupabaseClient<Database>;

export const MATCHES_PAGE_SIZE = 30;
export const MESSAGES_PAGE_SIZE = 30;

export async function fetchMatchesPage(client: Client, options: { cursor?: string | null; limit?: number } = {}): Promise<MatchesPage> {
  const limit = options.limit ?? MATCHES_PAGE_SIZE;
  const { data, error } = await client.rpc('get_matches', { p_limit: limit, p_cursor: options.cursor ?? undefined });
  if (error) throw error;
  const rows = data ?? [];
  return {
    matches: rows.map(
      (r): MatchSummary => ({
        matchId: r.match_id,
        profileId: r.profile_id,
        name: r.name,
        age: r.age,
        photoUrl: r.photo_url,
        matchedAt: r.matched_at,
        lastMessage: r.last_message,
        lastSenderId: r.last_sender_id,
        lastMessageAt: r.last_message_at,
        unreadCount: r.unread_count,
        yourTurn: r.your_turn,
        activityAt: r.activity_at,
      }),
    ),
    nextCursor: rows.length === limit ? rows[rows.length - 1].next_cursor : null,
  };
}

export async function fetchUnreadCount(client: Client): Promise<number> {
  const { data, error } = await client.rpc('get_unread_count');
  if (error) throw error;
  return data ?? 0;
}

const MESSAGE_COLUMNS = 'id, match_id, sender_id, body, created_at, read_at';

// Newest first; pass the oldest loaded message's created_at to load the page before it.
export async function fetchMessages(client: Client, matchId: string, before?: string | null): Promise<MessagesPage> {
  let query = client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  const messages = (data ?? []) as ChatMessage[];
  return {
    messages,
    nextCursor: messages.length === MESSAGES_PAGE_SIZE ? messages[messages.length - 1].created_at : null,
  };
}

export async function sendMessage(client: Client, matchId: string, senderId: string, body: string): Promise<ChatMessage> {
  const { data, error } = await client
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, body: body.trim() })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return data as ChatMessage;
}

export async function markMatchRead(client: Client, matchId: string): Promise<number> {
  const { data, error } = await client.rpc('mark_match_read', { p_match_id: matchId });
  if (error) throw error;
  return data ?? 0;
}

export async function unmatch(client: Client, matchId: string): Promise<void> {
  const { error } = await client.from('matches').update({ unmatched_at: new Date().toISOString() }).eq('id', matchId);
  if (error) throw error;
}

// One person's card (only people I may view: matches, people who liked me, my feed's city...).
export async function fetchProfile(client: Client, profileId: string): Promise<CardProfile | null> {
  const { data, error } = await client.rpc('get_profile', { p_profile_id: profileId });
  if (error) throw error;
  return data?.[0] ? toCardProfile(data[0]) : null;
}
