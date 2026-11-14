import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getSupabase } from '@/services/supabase';

import { fetchMessages, markMatchRead, sendMessage } from './api';
import { matchesKey, unreadCountKey } from './useMatches';
import type { ChatMessage, MessagesPage } from './types';

export const messagesKey = (matchId: string) => ['messages', matchId] as const;

type MessagesData = InfiniteData<MessagesPage, string | null>;

const TYPING_SEND_EVERY_MS = 2000;
const TYPING_SHOW_FOR_MS = 4000;

// Inserts or updates a message in the cache (pages are newest first), de-duplicated by id.
// replaceId drops the optimistic copy once the server's row is known.
function upsertMessage(old: MessagesData | undefined, message: ChatMessage, replaceId?: string): MessagesData | undefined {
  if (!old) return old;
  let found = false;
  const pages = old.pages.map((p) => ({
    ...p,
    messages: p.messages.flatMap((m) => {
      if (m.id === replaceId) return [];
      if (m.id !== message.id) return [m];
      found = true;
      return [{ ...m, ...message }];
    }),
  }));
  if (found) return { ...old, pages };
  const [first, ...rest] = pages;
  return { ...old, pages: [{ ...first, messages: [message, ...first.messages] }, ...rest] };
}

// One conversation: last 30 messages, older pages on scroll, live inserts/read receipts via
// Supabase Realtime, a typing indicator over Realtime broadcast, and optimistic sending.
export function useChat(matchId: string, userId: string) {
  const queryClient = useQueryClient();
  const key = messagesKey(matchId);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchMessages(getSupabase(), matchId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: Infinity, // kept current by Realtime
  });

  const messages = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.messages), [query.data]);

  const markRead = useCallback(async () => {
    try {
      const n = await markMatchRead(getSupabase(), matchId);
      if (n > 0) {
        queryClient.invalidateQueries({ queryKey: unreadCountKey(userId) });
        queryClient.invalidateQueries({ queryKey: matchesKey(userId) });
      }
    } catch {
      // Not critical: the next open marks them read.
    }
  }, [matchId, userId, queryClient]);

  // Mark the other person's messages read whenever unread ones are on screen.
  const hasUnread = messages.some((m) => m.sender_id !== userId && !m.read_at && !m.pending);
  useEffect(() => {
    if (hasUnread) markRead();
  }, [hasUnread, markRead]);

  useEffect(() => {
    const client = getSupabase();
    const filter = `match_id=eq.${matchId}`;
    const channel = client
      .channel(`match:${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, (payload) => {
        const message = payload.new as ChatMessage;
        queryClient.setQueryData<MessagesData>(key, (old) => upsertMessage(old, message));
        if (message.sender_id !== userId) setOtherTyping(false);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter }, (payload) => {
        const message = payload.new as ChatMessage;
        queryClient.setQueryData<MessagesData>(key, (old) =>
          old
            ? { ...old, pages: old.pages.map((p) => ({ ...p, messages: p.messages.map((m) => (m.id === message.id ? { ...m, read_at: message.read_at } : m)) })) }
            : old,
        );
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.userId === userId) return;
        setOtherTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setOtherTyping(false), TYPING_SHOW_FOR_MS);
      })
      .subscribe((status) => {
        // Catch anything sent between the first fetch and the live connection starting.
        if (status === 'SUBSCRIBED') queryClient.invalidateQueries({ queryKey: key });
      });
    channelRef.current = channel;
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      channelRef.current = null;
      client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, userId, queryClient]);

  // Call on every keystroke; sends at most one typing ping every 2 seconds.
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (!channelRef.current || now - lastTypingSent.current < TYPING_SEND_EVERY_MS) return;
    lastTypingSent.current = now;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId } });
  }, [userId]);

  const send = useMutation({
    mutationFn: ({ body }: { body: string; tempId: string }) => sendMessage(getSupabase(), matchId, userId, body),
    onMutate: ({ body, tempId }) => {
      const temp: ChatMessage = {
        id: tempId,
        match_id: matchId,
        sender_id: userId,
        body: body.trim(),
        created_at: new Date().toISOString(),
        read_at: null,
        pending: true,
      };
      queryClient.setQueryData<MessagesData>(key, (old) => upsertMessage(old, temp));
    },
    onSuccess: (message, { tempId }) => {
      queryClient.setQueryData<MessagesData>(key, (old) => upsertMessage(old, message, tempId));
      queryClient.invalidateQueries({ queryKey: matchesKey(userId) });
    },
    onError: (_error, { tempId }) => {
      queryClient.setQueryData<MessagesData>(key, (old) =>
        old
          ? { ...old, pages: old.pages.map((p) => ({ ...p, messages: p.messages.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)) })) }
          : old,
      );
    },
  });

  const sendText = useCallback(
    (body: string) => {
      if (!body.trim()) return;
      send.mutate({ body, tempId: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    },
    [send],
  );

  const removeFailed = useCallback(
    (id: string) =>
      queryClient.setQueryData<MessagesData>(key, (old) =>
        old ? { ...old, pages: old.pages.map((p) => ({ ...p, messages: p.messages.filter((m) => m.id !== id) })) } : old,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchId, queryClient],
  );

  return { query, messages, otherTyping, notifyTyping, sendText, sendError: send.error, removeFailed };
}
