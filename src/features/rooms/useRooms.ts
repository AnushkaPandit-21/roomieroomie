import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { CardProfile, FeedFilters } from '@/features/feed/types';
import { getSupabase } from '@/services/supabase';

import { fetchRoomsPage, sendInterest, type RoomsPage } from './api';

export const roomsKey = (userId: string, filters: FeedFilters) => ['rooms', userId, filters] as const;

type RoomsData = InfiniteData<RoomsPage, string | null>;

export function useRooms(userId: string, filters: FeedFilters) {
  const query = useInfiniteQuery({
    queryKey: roomsKey(userId, filters),
    queryFn: ({ pageParam }) => fetchRoomsPage(getSupabase(), { cursor: pageParam, filters }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 5 * 60 * 1000,
  });
  const rooms = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.rooms), [query.data]);
  return { query, rooms };
}

type Options = {
  onMatch: (host: CardProfile, matchId: string | null) => void;
  onError: (error: unknown) => void;
};

// "I'm interested": the room leaves the list straight away and returns if the server refuses.
export function useSendInterest(userId: string, { onMatch, onError }: Options) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ host, note }: { host: CardProfile; note?: string | null }) =>
      sendInterest(getSupabase(), userId, host, note),
    onMutate: async ({ host }) => {
      await queryClient.cancelQueries({ queryKey: ['rooms', userId] });
      const snapshots = queryClient.getQueriesData<RoomsData>({ queryKey: ['rooms', userId] });
      queryClient.setQueriesData<RoomsData>({ queryKey: ['rooms', userId] }, (old) =>
        old ? { ...old, pages: old.pages.map((p) => ({ ...p, rooms: p.rooms.filter((r) => r.id !== host.id) })) } : old,
      );
      return { snapshots };
    },
    onError: (error, _v, context) => {
      if ((error as { code?: string }).code !== '23505') {
        context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      onError(error);
    },
    onSuccess: (result, { host }) => {
      if (result.matched) onMatch(host, result.matchId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed', userId] });
      queryClient.invalidateQueries({ queryKey: ['matches', userId] });
    },
  });
}
