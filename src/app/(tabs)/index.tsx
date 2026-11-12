import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { EmptyState, Screen, ScreenHeader } from '@/components/layout';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { Button, IconButton, Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import { isDailyLimitError } from '@/features/feed/api';
import { FilterSheet } from '@/features/feed/components/FilterSheet';
import { LikeSheet } from '@/features/feed/components/LikeSheet';
import { MatchModal } from '@/features/feed/components/MatchModal';
import { hasActiveFilters, type CardProfile, type LikedItem } from '@/features/feed/types';
import { useFeed } from '@/features/feed/useFeed';
import { useOnboardingData } from '@/features/onboarding/useOnboardingData';
import { useProfilePhotoUrls, usePrefetchProfilePhotos } from '@/hooks/usePhotoUrls';
import { friendlyError } from '@/services/errors';
import { useFeedFilters } from '@/stores/feedFiltersStore';
import { useSessionStore } from '@/stores/sessionStore';

const LIMIT_MESSAGE = 'You’ve used today’s 25 likes. More at midnight.';

export default function DiscoverScreen() {
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const city = useOnboardingData(userId).data?.profile?.city ?? null;
  const filters = useFeedFilters((s) => s.filters);
  const setFilters = useFeedFilters((s) => s.setFilters);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [liking, setLiking] = useState<LikedItem | null>(null);
  const [match, setMatch] = useState<{ profile: CardProfile; photoUri?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Photo URLs of every card shown so far, so the match screen still has them after the card is gone.
  const seenUrls = useRef<Record<string, string>>({});

  const { query, current, next, act } = useFeed(userId, filters, {
    onMatch: (profile) =>
      setMatch({ profile, photoUri: profile.photos[0] ? seenUrls.current[profile.photos[0].url] : undefined }),
    onError: (error) => setNotice(isDailyLimitError(error) ? LIMIT_MESSAGE : friendlyError(error)),
  });

  const photoUrls = useProfilePhotoUrls(current);
  usePrefetchProfilePhotos(next);
  const urls = photoUrls.data ?? {};
  Object.assign(seenUrls.current, urls);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const filtersActive = hasActiveFilters(filters);

  const header = (
    <ScreenHeader
      title="Discover"
      right={
        <View>
          <IconButton
            icon="options-outline"
            accessibilityLabel={filtersActive ? 'Filters (active)' : 'Filters'}
            variant="surface"
            onPress={() => setFiltersOpen(true)}
          />
          {filtersActive ? <View className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-pill bg-brand" /> : null}
        </View>
      }
    />
  );

  let body;
  if (query.isPending) {
    body = (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  } else if (query.isError && !current) {
    body = (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn’t load profiles"
        description={friendlyError(query.error)}
        action={<Button label="Try again" onPress={() => query.refetch()} />}
      />
    );
  } else if (!current) {
    body = query.isFetchingNextPage ? (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.brand} />
      </View>
    ) : (
      <EmptyState
        icon="sparkles-outline"
        title="You’ve seen everyone for now"
        description={
          filtersActive
            ? 'Try widening your filters to see more people.'
            : 'New people join every day. Check back soon.'
        }
        action={
          filtersActive ? (
            <Button label="Adjust filters" variant="outline" onPress={() => setFiltersOpen(true)} />
          ) : (
            <Button label="Refresh" variant="outline" onPress={() => query.refetch()} />
          )
        }
      />
    );
  } else {
    body = (
      <View className="flex-1">
        <ScrollView
          key={current.id}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 112 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(200)}>
            <ProfileCard profile={current} photoUrls={urls} onLike={setLiking} />
          </Animated.View>
        </ScrollView>
        <View className="absolute bottom-4 left-0">
          <IconButton
            icon="close"
            accessibilityLabel={`Cross ${current.name}`}
            variant="surface"
            size="lg"
            floating
            onPress={() => act({ kind: 'pass', profile: current })}
          />
        </View>
      </View>
    );
  }

  return (
    <Screen header={header} scroll={false}>
      {notice ? (
        <View className="mb-3 rounded-lg bg-ink px-4 py-3" accessibilityLiveRegion="polite">
          <Text variant="label" tone="inverse">
            {notice}
          </Text>
        </View>
      ) : null}
      {body}

      <LikeSheet
        item={liking}
        name={current?.name ?? ''}
        photoUri={liking?.kind === 'photo' ? urls[liking.photo.url] : undefined}
        onClose={() => setLiking(null)}
        onSend={(comment) => {
          if (current && liking) {
            act({
              kind: 'like',
              profile: current,
              likedItemId: liking.kind === 'photo' ? liking.photo.id : liking.prompt.id,
              comment,
            });
          }
          setLiking(null);
        }}
      />
      <FilterSheet
        visible={filtersOpen}
        city={city}
        filters={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
        }}
      />
      <MatchModal name={match?.profile.name ?? null} photoUri={match?.photoUri} onClose={() => setMatch(null)} />
    </Screen>
  );
}
