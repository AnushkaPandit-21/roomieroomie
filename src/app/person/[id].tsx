import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { BackHeader, EmptyState, Screen } from '@/components/layout';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';
import { fetchProfile } from '@/features/chat/api';
import { ProfileSafetyButton } from '@/features/safety/components/ProfileSafetyButton';
import { useProfilePhotoUrls } from '@/hooks/usePhotoUrls';
import { friendlyError } from '@/services/errors';
import { getSupabase } from '@/services/supabase';
import { useSessionStore } from '@/stores/sessionStore';

// Read-only profile (e.g. a match, opened from chat). get_profile only returns people I may view.
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const query = useQuery({
    queryKey: ['profile', id],
    queryFn: () => fetchProfile(getSupabase(), id),
    staleTime: 5 * 60 * 1000,
  });
  const profile = query.data ?? null;
  const urls = useProfilePhotoUrls(profile).data ?? {};

  return (
    <Screen header={<BackHeader title={profile?.name ?? 'Profile'} />} scroll={false} edges={{ top: true, bottom: true }}>
      {query.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : query.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn’t load this profile"
          description={friendlyError(query.error)}
          action={<Button label="Try again" onPress={() => query.refetch()} />}
        />
      ) : !profile ? (
        <EmptyState icon="person-outline" title="This profile isn’t available" />
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <ProfileCard
            profile={profile}
            photoUrls={urls}
            headerAction={<ProfileSafetyButton userId={userId} target={{ id: profile.id, name: profile.name }} onDone={() => router.dismissTo('/matches')} />}
          />
        </ScrollView>
      )}
    </Screen>
  );
}
