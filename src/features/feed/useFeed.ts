import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { getSupabase } from '@/services/supabase';

import { fetchFeedPage, sendLike, sendPass, type FeedPage } from './api';
import type { CardProfile, FeedFilters } from './types';

export const feedKey = (userId: string, filters: FeedFilters) => ['feed', userId, filters] as const;

type FeedData = InfiniteData<FeedPage, string | null>;

export type FeedAction =
  | { kind: 'pass'; profile: CardProfile }
  | { kind: 'like'; profile: CardProfile; likedItemId?: string | null; comment?: string | null };

type Options = {
  onMatch: (profile: CardProfile) => void;
  onError: (error: unknown, action: FeedAction) => void;
};

// Feed pages from get_feed (20 at a time). Likes and passes remove the card immediately and
// put it back if the server rejects the action.
export function useFeed(userId: string, filters: FeedFilters, { onMatch, onError }: Options) {
  const queryClient = useQueryClient();
  const key = feedKey(userId, filters);

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchFeedPage(getSupabase(), userId, { cursor: pageParam, filters }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 5 * 60 * 1000,
  });

  const profiles = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? [])
      .flatMap((p) => p.profiles)
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }, [query.data]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (profiles.length <= 3 && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [profiles.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const removeLocally = (id: string) =>
    queryClient.setQueryData<FeedData>(key, (old) =>
      old ? { ...old, pages: old.pages.map((p) => ({ ...p, profiles: p.profiles.filter((x) => x.id !== id) })) } : old,
    );

  const action = useMutation({
    mutationFn: async (a: FeedAction) => {
      const client = getSupabase();
      if (a.kind === 'pass') {
        await sendPass(client, userId, a.profile.id);
        return { matched: false };
      }
      return sendLike(client, userId, a.profile.id, { likedItemId: a.likedItemId, comment: a.comment });
    },
    onMutate: async (a) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData<FeedData>(key);
      removeLocally(a.profile.id);
      return { snapshot };
    },
    onError: (error, a, context) => {
      // Already swiped (e.g. a double tap): the card should stay gone.
      if ((error as { code?: string }).code !== '23505' && context?.snapshot) {
        queryClient.setQueryData(key, context.snapshot);
      }
      onError(error, a);
    },
    onSuccess: (result, a) => {
      if (result.matched) onMatch(a.profile);
    },
  });

  return { query, profiles, current: profiles[0] ?? null, next: profiles[1] ?? null, act: action.mutate };
}
