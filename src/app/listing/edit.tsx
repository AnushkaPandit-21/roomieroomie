import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { BackHeader, Screen } from '@/components/layout';
import { Button, Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import { saveStep } from '@/features/onboarding/api';
import { answersFromData } from '@/features/onboarding/answers';
import { ListingForm } from '@/features/onboarding/components/ListingForm';
import { PhotoGrid } from '@/features/onboarding/components/PhotoGrid';
import { ROOM_PHOTO_LIMITS } from '@/features/onboarding/options';
import type { ListingDraft } from '@/features/onboarding/types';
import { useOnboardingData } from '@/features/onboarding/useOnboardingData';
import { validateStep } from '@/features/onboarding/validation';
import { friendlyError } from '@/services/errors';
import { getSupabase } from '@/services/supabase';
import { useSessionStore } from '@/stores/sessionStore';

// Hosts edit their room listing and room photos (same rules as onboarding). Never an address.
export default function EditListingScreen() {
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const queryClient = useQueryClient();
  const query = useOnboardingData(userId);
  const data = query.data;
  const [listing, setListing] = useState<ListingDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data && !listing) setListing(answersFromData(data).listing);
  }, [data, listing]);

  if (!data || !listing) {
    return (
      <Screen header={<BackHeader title="Your listing" />} scroll={false} edges={{ top: true, bottom: true }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  const answers = { ...answersFromData(data), listing };

  const save = async () => {
    const problem = validateStep('listing', answers, data) ?? validateStep('room_photos', answers, data);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveStep(getSupabase(), userId, 'listing', answers, data);
      await query.refetch();
      queryClient.invalidateQueries({ queryKey: ['rooms', userId] });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen header={<BackHeader title="Your listing" subtitle="Only the area is shown, never your address" />} scroll={false} edges={{ top: true, bottom: true }}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24, gap: 24 }} keyboardShouldPersistTaps="handled">
        <ListingForm city={data.profile?.city ?? null} listing={listing} onChange={setListing} />
        <View className="gap-3">
          <Text variant="subheading">Room photos</Text>
          <PhotoGrid
            userId={userId}
            allPhotos={data.photos}
            isRoomPhoto
            min={ROOM_PHOTO_LIMITS.min}
            max={ROOM_PHOTO_LIMITS.max}
            onChanged={() => query.refetch()}
            onBusyChange={setBusy}
          />
        </View>
      </ScrollView>
      <View className="gap-2 pt-3">
        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button label="Save listing" fullWidth loading={saving} disabled={busy} onPress={save} />
      </View>
    </Screen>
  );
}
