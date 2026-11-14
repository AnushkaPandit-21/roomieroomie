import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useMemo } from 'react';

import { sendLike, sendPass } from '@/features/feed/api';
import type { CardProfile } from '@/features/feed/types';
import { getSupabase } from '@/services/supabase';

import { fetchLikesYouCount, fetchLikesYouPage } from './api';
import type { LikesYouPage } from './types';

export const likesYouKey = (userId: string) => ['likes-you', userId] as const;
export const likesYouCountKey = (userId: string) => ['likes-you-count', userId] as const;

type LikesData = InfiniteData<LikesYouPage, string | null>;

export function useLikesYou(userId: string) {
  const query = useInfiniteQuery({
    queryKey: likesYouKey(userId),
    queryFn: ({ pageParam }) => fetchLikesYouPage(getSupabase(), { cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60 * 1000,
  });

  const likes = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.likes), [query.data]);
  return { query, likes };
}

// Tab badge. Refreshed when the app comes back to the foreground (TanStack Query's focus refetch).
export function useLikesYouCount(userId: string | undefined) {
  return useQuery({
    queryKey: likesYouCountKey(userId ?? 'none'),
    queryFn: () => fetchLikesYouCount(getSupabase()),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export type LikeResponse =
  | { kind: 'cross'; profile: CardProfile }
  | { kind: 'like'; profile: CardProfile; likedItemId?: string | null; comment?: string | null };

type Options = {
  onMatch: (profile: CardProfile, matchId: string | null) => void;
  onError: (error: unknown) => void;
};

// Like back (creates the match through the database trigger) or cross. The person leaves Likes You
// immediately and comes back if the server rejects it.
export function useRespondToLike(userId: string, { onMatch, onError }: Options) {
  const queryClient = useQueryClient();
  const key = likesYouKey(userId);

  return useMutation({
    mutationFn: async (r: LikeResponse) => {
      const client = getSupabase();
      if (r.kind === 'cross') {
        await sendPass(client, userId, r.profile.id);
        return { matched: false, matchId: null };
      }
      return sendLike(client, userId, r.profile.id, { likedItemId: r.likedItemId, comment: r.comment });
    },
    onMutate: async (r) => {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData<LikesData>(key);
      queryClient.setQueryData<LikesData>(key, (old) =>
        old
          ? { ...old, pages: old.pages.map((p) => ({ ...p, likes: p.likes.filter((l) => l.profile.id !== r.profile.id) })) }
          : old,
      );
      queryClient.setQueryData<number>(likesYouCountKey(userId), (n) => (n ? n - 1 : n));
      return { snapshot };
    },
    onError: (error, _r, context) => {
      // Already answered (e.g. a double tap): they should stay gone.
      if ((error as { code?: string }).code !== '23505' && context?.snapshot) {
        queryClient.setQueryData(key, context.snapshot);
      }
      onError(error);
    },
    onSuccess: (result, r) => {
      if (result.matched) onMatch(r.profile, result.matchId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: likesYouCountKey(userId) });
      // They may also be waiting in a Discover page or the Matches list.
      queryClient.invalidateQueries({ queryKey: ['feed', userId] });
      queryClient.invalidateQueries({ queryKey: ['matches', userId] });
    },
  });
}
