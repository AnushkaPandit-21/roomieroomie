import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';

import { BackHeader, Screen } from '@/components/layout';
import { Card, Icon, IconButton, Text } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import type { ChatMessage } from '@/features/chat/types';
import { useChat } from '@/features/chat/useChat';
import { useMatches } from '@/features/chat/useMatches';
import { ActionSheet } from '@/features/safety/components/ActionSheet';
import { ReportSheet } from '@/features/safety/components/ReportSheet';
import { useSafetyAction } from '@/features/safety/useSafety';
import { friendlyError } from '@/services/errors';
import { useSessionStore } from '@/stores/sessionStore';
import { formatChatTime } from '@/utils/date';

const MAX_MESSAGE = 2000;

// Shown before the first message of every conversation (CLAUDE.md §10).
function SafetyTips({ name }: { name: string }) {
  return (
    <Card className="mb-4">
      <View className="flex-row items-center gap-2">
        <Icon name="shield-checkmark-outline" size={20} color="accent" />
        <Text variant="subheading">Before you meet {name}</Text>
      </View>
      <View className="mt-3 gap-2">
        <Text>• Meet somewhere public the first time.</Text>
        <Text>• Visit the flat or PG together before deciding.</Text>
        <Text>• Never pay a deposit or token amount before you’ve seen the place.</Text>
        <Text tone="muted" variant="caption" style={{ marginTop: 4 }}>
          If something feels off, use the menu to report or block.
        </Text>
      </View>
    </Card>
  );
}

function Bubble({ message, mine, showStatus, onRetry }: { message: ChatMessage; mine: boolean; showStatus: boolean; onRetry: () => void }) {
  const status = message.failed ? 'Not sent · tap to retry' : message.pending ? 'Sending…' : message.read_at ? 'Read' : 'Sent';
  return (
    <View className={mine ? 'items-end' : 'items-start'} style={{ marginBottom: 6 }}>
      <Pressable
        disabled={!message.failed}
        onPress={onRetry}
        accessibilityLabel={message.failed ? `${message.body}. Not sent, tap to retry` : undefined}
        className={mine ? 'rounded-2xl rounded-br-md bg-brand px-4 py-2.5' : 'rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-2.5'}
        style={{ maxWidth: '80%', opacity: message.pending ? 0.7 : 1 }}
      >
        <Text tone={mine ? 'inverse' : 'default'} selectable>
          {message.body}
        </Text>
      </Pressable>
      {showStatus || message.failed ? (
        <Text variant="caption" tone={message.failed ? 'danger' : 'subtle'} style={{ marginTop: 2 }}>
          {mine ? status : formatChatTime(message.created_at)}
        </Text>
      ) : null}
    </View>
  );
}

// One conversation: live messages, read receipts, typing indicator, older messages on scroll,
// and unmatch / report / block in the menu (CLAUDE.md §2, §8).
export default function ChatScreen() {
  const params = useLocalSearchParams<{ id: string; profileId?: string; name?: string }>();
  const matchId = params.id;
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const { newMatches, conversations } = useMatches(userId);
  const summary = [...newMatches, ...conversations].find((m) => m.matchId === matchId);
  const name = params.name ?? summary?.name ?? 'Chat';
  const profileId = params.profileId ?? summary?.profileId;

  const { query, messages, otherTyping, notifyTyping, sendText, removeFailed } = useChat(matchId, userId);
  const safety = useSafetyAction(userId);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  const lastMineId = messages.find((m) => m.sender_id === userId)?.id;
  const viewProfile = () => profileId && router.push({ pathname: '/person/[id]', params: { id: profileId } });

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/matches'));
  const runSafety = (action: Parameters<typeof safety.mutate>[0], done: () => void) =>
    safety.mutate(action, { onSuccess: done, onError: (e) => Alert.alert('Something went wrong', friendlyError(e)) });

  const confirmUnmatch = () =>
    Alert.alert(`Unmatch ${name}?`, 'The chat will disappear for both of you. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unmatch', style: 'destructive', onPress: () => runSafety({ kind: 'unmatch', matchId }, leave) },
    ]);
  const confirmBlock = () =>
    profileId &&
    Alert.alert(`Block ${name}?`, 'You won’t see each other anywhere in RoomieRoomie again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => runSafety({ kind: 'block', targetId: profileId }, leave) },
    ]);

  const send = () => {
    if (!draft.trim()) return;
    sendText(draft);
    setDraft('');
  };

  return (
    <Screen
      scroll={false}
      edges={{ top: true, bottom: true }}
      header={
        <BackHeader
          title={name}
          subtitle={otherTyping ? 'typing…' : undefined}
          right={
            <>
              {profileId ? <IconButton icon="person-circle-outline" accessibilityLabel={`View ${name}'s profile`} onPress={viewProfile} /> : null}
              <IconButton icon="ellipsis-horizontal" accessibilityLabel="Chat options" onPress={() => setMenuOpen(true)} />
            </>
          }
        />
      }
    >
      <KeyboardAvoidingView className="flex-1" behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
        {query.isPending ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : (
          <FlatList
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            className="flex-1"
            contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onEndReachedThreshold={0.3}
            onEndReached={() => {
              if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
            }}
            renderItem={({ item }) => (
              <Bubble
                message={item}
                mine={item.sender_id === userId}
                showStatus={item.id === lastMineId || (item.sender_id !== userId && item === messages[0])}
                onRetry={() => {
                  removeFailed(item.id);
                  sendText(item.body);
                }}
              />
            )}
            // Inverted list: the "footer" renders at the top, above the oldest message.
            ListFooterComponent={
              query.isFetchingNextPage ? (
                <ActivityIndicator color={colors.brand} />
              ) : !query.hasNextPage ? (
                <View className="pt-2">
                  <SafetyTips name={name} />
                  {!messages.length ? (
                    <Text tone="muted" align="center">
                      You matched with {name}. Say hello!
                    </Text>
                  ) : null}
                </View>
              ) : undefined
            }
          />
        )}

        <View className="flex-row items-end gap-2 border-t border-line pt-3">
          <TextInput
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              if (text) notifyTyping();
            }}
            placeholder={`Message ${name}`}
            placeholderTextColor={colors['ink-subtle']}
            selectionColor={colors.brand}
            multiline
            maxLength={MAX_MESSAGE}
            accessibilityLabel="Message"
            className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-ink"
            style={{ fontFamily: fonts.sans, fontSize: 16, maxHeight: 120 }}
          />
          <IconButton
            icon="send"
            variant="brand"
            accessibilityLabel="Send"
            disabled={!draft.trim()}
            onPress={send}
          />
        </View>
      </KeyboardAvoidingView>

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={[
          ...(profileId ? [{ label: `View ${name}'s profile`, icon: 'person-outline' as const, onPress: viewProfile }] : []),
          { label: 'Unmatch', icon: 'heart-dislike-outline', onPress: confirmUnmatch },
          ...(profileId
            ? [
                { label: 'Report', icon: 'flag-outline' as const, destructive: true, onPress: () => setReporting(true) },
                { label: 'Block', icon: 'ban-outline' as const, destructive: true, onPress: confirmBlock },
              ]
            : []),
        ]}
      />
      <ReportSheet
        visible={reporting}
        name={name}
        busy={safety.isPending}
        error={safety.error ? friendlyError(safety.error) : null}
        onClose={() => setReporting(false)}
        onSubmit={(reason) =>
          profileId &&
          safety.mutate(
            { kind: 'report', targetId: profileId, reason, matchId },
            {
              onSuccess: () => {
                setReporting(false);
                Alert.alert('Thanks for telling us', `We’ll review your report. You won’t see ${name} again.`);
                leave();
              },
            },
          )
        }
      />
    </Screen>
  );
}
