import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { BackHeader, EmptyState, Screen } from '@/components/layout';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { Button, Card, Chip, Input, Photo, Sheet, Text } from '@/components/ui';
import { DAILY_LIMIT_MESSAGE, isDailyLimitError } from '@/features/feed/api';
import { MatchModal } from '@/features/feed/components/MatchModal';
import type { CardProfile } from '@/features/feed/types';
import { LIMITS } from '@/features/onboarding/options';
import type { RoomsPage } from '@/features/rooms/api';
import { occupancyLabel } from '@/features/rooms/components/RoomCard';
import { useSendInterest } from '@/features/rooms/useRooms';
import { ProfileSafetyButton } from '@/features/safety/components/ProfileSafetyButton';
import { useProfilePhotoUrls } from '@/hooks/usePhotoUrls';
import { friendlyError } from '@/services/errors';
import { useSessionStore } from '@/stores/sessionStore';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/format';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2">
      <Text tone="muted">{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

// A room: photos, rent/deposit/area/date/occupancy/amenities, then the host's full profile.
// Only the area is shown — never an address (CLAUDE.md §2, §10).
export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const queryClient = useQueryClient();

  // The room comes from the Rooms list already in memory; keep it after "I'm interested" removes it.
  const [host] = useState<CardProfile | undefined>(() =>
    queryClient
      .getQueriesData<InfiniteData<RoomsPage>>({ queryKey: ['rooms', userId] })
      .flatMap(([, data]) => data?.pages.flatMap((p) => p.rooms) ?? [])
      .find((r) => r.id === id),
  );
  const urls = useProfilePhotoUrls(host ?? null).data ?? {};
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [match, setMatch] = useState<{ matchId: string | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const interest = useSendInterest(userId, {
    onMatch: (_h, matchId) => setMatch({ matchId }),
    onError: (error) => setNotice(isDailyLimitError(error) ? DAILY_LIMIT_MESSAGE : friendlyError(error)),
  });

  if (!host?.listing) {
    return (
      <Screen header={<BackHeader title="Room" />} scroll={false} edges={{ top: true, bottom: true }}>
        <EmptyState icon="home-outline" title="This room is no longer available" />
      </Screen>
    );
  }

  const l = host.listing;
  const send = () => {
    setNoteOpen(false);
    interest.mutate(
      { host, note },
      { onSuccess: (result) => !result.matched && router.back() },
    );
  };

  return (
    <Screen header={<BackHeader title={`${l.area} · ${formatRupees(l.rent)}/mo`} subtitle={`Hosted by ${host.name}`} />} scroll={false} edges={{ top: true, bottom: true }}>
      {notice ? (
        <View className="mb-3 rounded-lg bg-ink px-4 py-3" accessibilityLiveRegion="polite">
          <Text variant="label" tone="inverse">
            {notice}
          </Text>
        </View>
      ) : null}
      <View className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 112, gap: 16 }} showsVerticalScrollIndicator={false}>
          {l.room_photos.map((p) => (
            <Photo key={p.id} source={urls[p.url] ? { uri: urls[p.url] } : undefined} aspectRatio={4 / 3} accessibilityLabel="Room photo" />
          ))}
          <Card>
            <Text variant="heading">{formatRupees(l.rent)}/mo</Text>
            <Text tone="muted">{l.area} · exact address shared after you match</Text>
            <View className="mt-3">
              <Fact label="Deposit" value={l.deposit ? formatRupees(l.deposit) : 'None'} />
              <Fact label="Available from" value={formatDisplayDate(l.available_from)} />
              {occupancyLabel(l.occupancy) ? <Fact label="Occupancy" value={occupancyLabel(l.occupancy)!} /> : null}
              {l.furnished != null ? <Fact label="Furnishing" value={l.furnished ? 'Furnished' : 'Unfurnished'} /> : null}
            </View>
            {l.amenities.length ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {l.amenities.map((a) => (
                  <Chip key={a} label={a} />
                ))}
              </View>
            ) : null}
          </Card>
          <Text variant="label" tone="muted">
            Your host
          </Text>
          <ProfileCard
            profile={host}
            photoUrls={urls}
            headerAction={<ProfileSafetyButton userId={userId} target={{ id: host.id, name: host.name }} onDone={() => router.back()} />}
          />
        </ScrollView>
        <View className="absolute bottom-4 left-0 right-0">
          <Button label="I’m interested" leftIcon="heart" fullWidth loading={interest.isPending} onPress={() => setNoteOpen(true)} />
        </View>
      </View>

      <Sheet
        visible={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={`Tell ${host.name} you’re interested`}
        footer={<Button label="Send" leftIcon="heart" fullWidth onPress={send} />}
      >
        <Text tone="muted" style={{ marginBottom: 12 }}>
          This counts as a like. If {host.name} likes you back, you’ll match and can chat.
        </Text>
        <Input
          label="Add a note (optional)"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={LIMITS.promptAnswer}
          placeholder="e.g. Could I visit this weekend?"
        />
      </Sheet>
      <MatchModal
        name={match ? host.name : null}
        photoUri={host.photos[0] ? urls[host.photos[0].url] : undefined}
        closeLabel="Back to Rooms"
        onClose={() => {
          setMatch(null);
          router.back();
        }}
        onMessage={
          match?.matchId
            ? () => {
                const matchId = match.matchId!;
                setMatch(null);
                router.replace({ pathname: '/chat/[id]', params: { id: matchId, profileId: host.id, name: host.name } });
              }
            : undefined
        }
      />
    </Screen>
  );
}
