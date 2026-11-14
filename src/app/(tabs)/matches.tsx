import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { EmptyState, Screen, ScreenHeader } from '@/components/layout';
import { Button, Photo, Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import type { MatchSummary } from '@/features/chat/types';
import { useMatches } from '@/features/chat/useMatches';
import { useSignedPhotoUrls } from '@/hooks/usePhotoUrls';
import { friendlyError } from '@/services/errors';
import { useSessionStore } from '@/stores/sessionStore';
import { formatChatTime } from '@/utils/date';

const openChat = (m: MatchSummary) =>
  router.push({ pathname: '/chat/[id]', params: { id: m.matchId, profileId: m.profileId, name: m.name } });

function NewMatch({ match, uri }: { match: MatchSummary; uri?: string }) {
  return (
    <Pressable
      className="w-20 items-center"
      accessibilityRole="button"
      accessibilityLabel={`New match: ${match.name}. Start a chat`}
      onPress={() => openChat(match)}
    >
      <View className="w-[72px] rounded-pill border-2 border-brand p-0.5">
        <Photo source={uri ? { uri } : undefined} aspectRatio={1} rounded="pill" />
      </View>
      <Text variant="caption" numberOfLines={1} style={{ marginTop: 6 }}>
        {match.name}
      </Text>
    </Pressable>
  );
}

function Conversation({ match, uri, userId }: { match: MatchSummary; uri?: string; userId: string }) {
  const unread = match.unreadCount > 0;
  const preview = `${match.lastSenderId === userId ? 'You: ' : ''}${match.lastMessage ?? ''}`;
  return (
    <Pressable
      className="flex-row items-center gap-3 py-3"
      accessibilityRole="button"
      accessibilityLabel={`${match.name}. ${match.yourTurn ? 'Your turn. ' : ''}${unread ? `${match.unreadCount} unread. ` : ''}${preview}`}
      onPress={() => openChat(match)}
    >
      {({ pressed }) => (
        <>
          <View className="w-14" style={{ opacity: pressed ? 0.85 : 1 }}>
            <Photo source={uri ? { uri } : undefined} aspectRatio={1} rounded="pill" />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text variant="subheading" numberOfLines={1} style={{ flexShrink: 1 }}>
                {match.name}
              </Text>
              {match.yourTurn ? (
                <View className="rounded-pill bg-brand px-2 py-0.5">
                  <Text variant="caption" tone="inverse">
                    Your turn
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant={unread ? 'bodyStrong' : 'body'} tone={unread ? 'default' : 'muted'} numberOfLines={1}>
              {preview}
            </Text>
          </View>
          <View className="items-end gap-1">
            {match.lastMessageAt ? (
              <Text variant="caption" tone="subtle">
                {formatChatTime(match.lastMessageAt)}
              </Text>
            ) : null}
            {unread ? <View className="h-2.5 w-2.5 rounded-pill bg-brand" /> : null}
          </View>
        </>
      )}
    </Pressable>
  );
}

// New matches on top, then conversations by latest message with a "Your turn" badge (CLAUDE.md §2).
export default function MatchesScreen() {
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const { query, newMatches, conversations } = useMatches(userId);
  const photos = useSignedPhotoUrls(
    [...newMatches, ...conversations].map((m) => m.photoUrl).filter(Boolean) as string[],
  );
  const urls = photos.data ?? {};
  const header = <ScreenHeader title="Matches" />;

  if (query.isPending) {
    return (
      <Screen header={header} scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }
  if (query.isError && !newMatches.length && !conversations.length) {
    return (
      <Screen header={header} scroll={false}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn’t load your matches"
          description={friendlyError(query.error)}
          action={<Button label="Try again" onPress={() => query.refetch()} />}
        />
      </Screen>
    );
  }
  if (!newMatches.length && !conversations.length) {
    return (
      <Screen header={header} scroll={false}>
        <EmptyState
          icon="chatbubbles-outline"
          title="No matches yet"
          description="When you and someone like each other, you can chat here."
          action={<Button label="Discover people" variant="outline" onPress={() => router.navigate('/')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen header={header} scroll={false}>
      <FlatList
        data={conversations}
        keyExtractor={(m) => m.matchId}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.brand} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        ListHeaderComponent={
          <View>
            {newMatches.length ? (
              <View className="mb-4">
                <Text variant="label" tone="muted" style={{ marginBottom: 10 }}>
                  New matches
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {newMatches.map((m) => (
                    <NewMatch key={m.matchId} match={m} uri={m.photoUrl ? urls[m.photoUrl] : undefined} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
            {conversations.length ? (
              <Text variant="label" tone="muted">
                Conversations
              </Text>
            ) : (
              <Text tone="muted">Say hi to your new matches. Conversations will show up here.</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Conversation match={item} uri={item.photoUrl ? urls[item.photoUrl] : undefined} userId={userId} />
        )}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.brand} /> : undefined}
      />
    </Screen>
  );
}
