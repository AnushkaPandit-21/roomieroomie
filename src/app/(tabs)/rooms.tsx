import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { EmptyState, Screen, ScreenHeader } from '@/components/layout';
import { Button, Card, IconButton, Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import { FilterSheet } from '@/features/feed/components/FilterSheet';
import { hasActiveFilters } from '@/features/feed/types';
import { useOnboardingData } from '@/features/onboarding/useOnboardingData';
import { RoomCard } from '@/features/rooms/components/RoomCard';
import { useRooms } from '@/features/rooms/useRooms';
import { useResponsive } from '@/hooks/useResponsive';
import { useSignedPhotoUrls } from '@/hooks/usePhotoUrls';
import { friendlyError } from '@/services/errors';
import { useRoomsFilters } from '@/stores/roomsFiltersStore';
import { useSessionStore } from '@/stores/sessionStore';
import { formatRupees } from '@/utils/format';

// Hosts with a room (CLAUDE.md §2). Filters: area, max rent, available by. Hosts manage their own
// listing from the card at the top.
export default function RoomsScreen() {
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const mine = useOnboardingData(userId).data;
  const city = mine?.profile?.city ?? null;
  const myListing = mine?.listing ?? null;
  const filters = useRoomsFilters((s) => s.filters);
  const setFilters = useRoomsFilters((s) => s.setFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { gutter } = useResponsive();

  const { query, rooms } = useRooms(userId, filters);
  const photos = useSignedPhotoUrls(
    rooms.flatMap((r) => [r.listing?.room_photos[0]?.url, r.photos[0]?.url]).filter(Boolean) as string[],
  );
  const urls = photos.data ?? {};
  const filtersActive = hasActiveFilters(filters);

  const header = (
    <ScreenHeader
      title="Rooms"
      subtitle={city ? `Rooms in ${city}` : undefined}
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

  const listingCard = myListing ? (
    <Card className="mb-4" style={{ backgroundColor: colors['accent-soft'] }} elevated={false}>
      <Text variant="overline" tone="accent">
        Your listing
      </Text>
      <Text variant="subheading" style={{ marginTop: 4 }}>
        {myListing.area} · {formatRupees(myListing.rent)}/mo
      </Text>
      <View className="mt-3 flex-row">
        <Button label="Edit listing" variant="outline" size="md" leftIcon="create-outline" onPress={() => router.push('/listing/edit')} />
      </View>
    </Card>
  ) : null;

  let body;
  if (query.isPending) {
    body = (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  } else if (query.isError && !rooms.length) {
    body = (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn’t load rooms"
        description={friendlyError(query.error)}
        action={<Button label="Try again" onPress={() => query.refetch()} />}
      />
    );
  } else {
    body = (
      <FlatList
        data={rooms}
        keyExtractor={(r) => r.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: gutter, paddingBottom: 24, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.brand} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        ListHeaderComponent={listingCard ?? undefined}
        renderItem={({ item }) => (
          <RoomCard
            host={item}
            roomUri={item.listing?.room_photos[0] ? urls[item.listing.room_photos[0].url] : undefined}
            hostUri={item.photos[0] ? urls[item.photos[0].url] : undefined}
            onPress={() => router.push({ pathname: '/room/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="home-outline"
            title="No rooms right now"
            description={
              filtersActive ? 'Try widening your filters to see more rooms.' : 'New rooms are listed every day. Check back soon.'
            }
            action={
              filtersActive ? <Button label="Adjust filters" variant="outline" onPress={() => setFiltersOpen(true)} /> : undefined
            }
          />
        }
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.brand} /> : undefined}
      />
    );
  }

  return (
    <Screen header={header} scroll={false}>
      {body}
      <FilterSheet
        visible={filtersOpen}
        city={city}
        filters={filters}
        budgetTitle="Rent, up to"
        dateTitle="Available by"
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
        }}
      />
    </Screen>
  );
}
