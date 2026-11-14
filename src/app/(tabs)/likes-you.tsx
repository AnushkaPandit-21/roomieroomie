import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { EmptyState, Screen, ScreenHeader } from '@/components/layout';
import { Button, Photo, Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import { likedItemLabel } from '@/features/likes/labels';
import type { IncomingLike } from '@/features/likes/types';
import { useLikesYou } from '@/features/likes/useLikesYou';
import { useOnboardingData } from '@/features/onboarding/useOnboardingData';
import { useResponsive } from '@/hooks/useResponsive';
import { useSignedPhotoUrls } from '@/hooks/usePhotoUrls';
import { friendlyError } from '@/services/errors';
import { useSessionStore } from '@/stores/sessionStore';

function LikeTile({ like, uri, label }: { like: IncomingLike; uri?: string; label: string }) {
  const { profile } = like;
  return (
    <Pressable
      className="flex-1"
      accessibilityRole="button"
      accessibilityLabel={`${profile.name}, ${profile.age}. ${label}${like.comment ? `. "${like.comment}"` : ''}`}
      onPress={() => router.push({ pathname: '/like/[id]', params: { id: profile.id } })}
    >
      {({ pressed }) => (
        <View style={{ opacity: pressed ? 0.85 : 1 }}>
          <Photo source={uri ? { uri } : undefined} rounded="lg" />
          <Text variant="subheading" numberOfLines={1} style={{ marginTop: 8 }}>
            {profile.name}, {profile.age}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {label}
          </Text>
          {like.comment ? (
            <Text variant="caption" numberOfLines={2} style={{ marginTop: 2 }}>
              “{like.comment}”
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

// Who liked me, with what they liked and their comment (CLAUDE.md §2). Tap to answer.
export default function LikesYouScreen() {
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const mine = useOnboardingData(userId).data;
  const { query, likes } = useLikesYou(userId);
  const { gutter } = useResponsive();

  const thumbs = useSignedPhotoUrls(likes.map((l) => l.profile.photos[0]?.url).filter(Boolean) as string[]);
  const urls = thumbs.data ?? {};

  const header = (
    <ScreenHeader
      title="Likes You"
      subtitle={likes.length ? 'Like back to match, or cross to dismiss.' : undefined}
    />
  );

  if (query.isPending) {
    return (
      <Screen header={header} scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  if (query.isError && !likes.length) {
    return (
      <Screen header={header} scroll={false}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn’t load your likes"
          description={friendlyError(query.error)}
          action={<Button label="Try again" onPress={() => query.refetch()} />}
        />
      </Screen>
    );
  }

  return (
    <Screen header={header} scroll={false}>
      <FlatList
        data={likes}
        keyExtractor={(l) => l.profile.id}
        numColumns={2}
        columnWrapperStyle={{ gap: gutter }}
        contentContainerStyle={{ gap: 20, paddingBottom: 24, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.brand} />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        renderItem={({ item, index }) => (
          <>
            <LikeTile
              like={item}
              uri={item.profile.photos[0] ? urls[item.profile.photos[0].url] : undefined}
              label={likedItemLabel(item.likedItemId, mine)}
            />
            {/* Keep a lone last tile half width. */}
            {index === likes.length - 1 && likes.length % 2 === 1 ? <View className="flex-1" /> : null}
          </>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="No likes yet"
            description="When someone likes your profile, they’ll show up here. A complete profile with great photos helps."
          />
        }
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.brand} /> : undefined}
      />
    </Screen>
  );
}
