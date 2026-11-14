import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { getSupabase } from '@/services/supabase';

import { fetchMatchesPage, fetchUnreadCount } from './api';

export const matchesKey = (userId: string) => ['matches', userId] as const;
export const unreadCountKey = (userId: string) => ['unread-count', userId] as const;

// Matches tab: new matches (no messages yet) for the top row, conversations by latest message.
export function useMatches(userId: string) {
  const query = useInfiniteQuery({
    queryKey: matchesKey(userId),
    queryFn: ({ pageParam }) => fetchMatchesPage(getSupabase(), { cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30 * 1000,
  });

  const { newMatches, conversations } = useMemo(() => {
    const all = (query.data?.pages ?? []).flatMap((p) => p.matches);
    return {
      newMatches: all.filter((m) => !m.lastMessage),
      conversations: all.filter((m) => !!m.lastMessage),
    };
  }, [query.data]);

  return { query, newMatches, conversations };
}

export function useUnreadCount(userId: string | undefined) {
  return useQuery({
    queryKey: unreadCountKey(userId ?? 'none'),
    queryFn: () => fetchUnreadCount(getSupabase()),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

// Keeps the Matches list, badges and Likes You fresh while the app is open: any new message or
// match change I'm allowed to see (Realtime applies RLS) refreshes them.
export function useInboxRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const client = getSupabase();
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: matchesKey(userId) });
      queryClient.invalidateQueries({ queryKey: unreadCountKey(userId) });
    };
    const channel = client
      .channel(`inbox:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        refresh();
        queryClient.invalidateQueries({ queryKey: ['likes-you', userId] });
        queryClient.invalidateQueries({ queryKey: ['likes-you-count', userId] });
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
