import { Pressable, View } from 'react-native';

import { Card, Photo, Text } from '@/components/ui';
import type { CardProfile } from '@/features/feed/types';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/format';

type RoomCardProps = {
  host: CardProfile;
  roomUri?: string;
  hostUri?: string;
  onPress: () => void;
};

export function occupancyLabel(occupancy: number | null): string | null {
  if (occupancy == null) return null;
  return occupancy === 1 ? 'Private room' : `${occupancy} sharing`;
}

// One listing in the Rooms list: room photo, rent, area, date, and the host's mini profile.
export function RoomCard({ host, roomUri, hostUri, onPress }: RoomCardProps) {
  const l = host.listing!;
  const facts = [occupancyLabel(l.occupancy), l.furnished == null ? null : l.furnished ? 'Furnished' : 'Unfurnished'].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${l.area}, ${formatRupees(l.rent)} a month, available from ${formatDisplayDate(l.available_from)}. Hosted by ${host.name}`}
      onPress={onPress}
    >
      {({ pressed }) => (
        <Card padded={false} style={{ opacity: pressed ? 0.9 : 1 }}>
          <Photo source={roomUri ? { uri: roomUri } : undefined} aspectRatio={4 / 3} rounded="xl" />
          <View className="gap-1 p-4">
            <View className="flex-row items-baseline justify-between">
              <Text variant="heading">{formatRupees(l.rent)}/mo</Text>
              {host.matchScore != null ? (
                <Text variant="label" tone="brand">
                  {host.matchScore}% match
                </Text>
              ) : null}
            </View>
            <Text variant="bodyStrong">{l.area}</Text>
            <Text tone="muted" variant="caption">
              Available {formatDisplayDate(l.available_from)}
              {facts.length ? ` · ${facts.join(' · ')}` : ''}
            </Text>
            <View className="mt-3 flex-row items-center gap-3 border-t border-line pt-3">
              <View className="w-9">
                <Photo source={hostUri ? { uri: hostUri } : undefined} aspectRatio={1} rounded="pill" />
              </View>
              <Text variant="label" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                Hosted by {host.name}, {host.age}
                {host.occupation ? ` · ${host.occupation}` : ''}
              </Text>
            </View>
          </View>
        </Card>
      )}
    </Pressable>
  );
}
