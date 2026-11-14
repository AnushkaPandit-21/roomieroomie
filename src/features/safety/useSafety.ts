import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unmatch } from '@/features/chat/api';
import { getSupabase } from '@/services/supabase';

import { blockUser, reportUser } from './api';

export type SafetyAction =
  | { kind: 'report'; targetId: string; reason: string; matchId?: string | null }
  | { kind: 'block'; targetId: string }
  | { kind: 'unmatch'; matchId: string };

// Report (also unmatches, so the chat closes), block, or unmatch — then refresh every list
// the person could appear in.
export function useSafetyAction(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (a: SafetyAction) => {
      const client = getSupabase();
      if (a.kind === 'report') {
        await reportUser(client, userId, a.targetId, a.reason);
        if (a.matchId) await unmatch(client, a.matchId);
      } else if (a.kind === 'block') {
        await blockUser(client, userId, a.targetId);
      } else {
        await unmatch(client, a.matchId);
      }
    },
    onSettled: () => {
      for (const key of ['feed', 'likes-you', 'likes-you-count', 'matches', 'unread-count', 'rooms']) {
        queryClient.invalidateQueries({ queryKey: [key, userId] });
      }
    },
  });
}
