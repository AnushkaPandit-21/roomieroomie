import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { BackHeader, EmptyState, Screen } from '@/components/layout';
import { Button, Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import { answersFromData } from '@/features/onboarding/answers';
import { saveStep } from '@/features/onboarding/api';
import { StepContent } from '@/features/onboarding/components/StepContent';
import { STEP_COPY } from '@/features/onboarding/copy';
import { STEP_IDS, type StepId } from '@/features/onboarding/steps';
import type { Answers } from '@/features/onboarding/types';
import { useOnboardingData } from '@/features/onboarding/useOnboardingData';
import { validateStep } from '@/features/onboarding/validation';
import { friendlyError } from '@/services/errors';
import { getSupabase } from '@/services/supabase';
import { useSessionStore } from '@/stores/sessionStore';

// Extra context where an edit has knock-on effects.
const WARNINGS: Partial<Record<StepId, (a: Answers, before: Answers) => string | null>> = {
  seeking_type: (a, before) =>
    a.seeking_type === before.seeking_type
      ? null
      : a.seeking_type === 'need_place'
        ? 'Your room listing and room photos will be removed.'
        : 'Next, you’ll add your room details and room photos.',
  city_areas: (a, before) => (a.city !== before.city ? 'Changing city shows you people in the new city.' : null),
};

// Edit one profile answer with the onboarding screen for it; saves the same way.
export default function EditStepScreen() {
  const { step: param } = useLocalSearchParams<{ step: string }>();
  const step = (STEP_IDS as readonly string[]).includes(param) ? (param as StepId) : null;
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const queryClient = useQueryClient();
  const query = useOnboardingData(userId);
  const data = query.data;

  const [answers, setAnswers] = useState<Answers | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data && !answers) setAnswers(answersFromData(data));
  }, [data, answers]);

  if (!step) {
    return (
      <Screen header={<BackHeader title="Edit" />} scroll={false} edges={{ top: true, bottom: true }}>
        <EmptyState icon="help-circle-outline" title="Nothing to edit here" />
      </Screen>
    );
  }
  if (!data || !answers) {
    return (
      <Screen header={<BackHeader title="Edit" />} scroll={false} edges={{ top: true, bottom: true }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  const copy = STEP_COPY[step];
  const warning = WARNINGS[step]?.(answers, answersFromData(data)) ?? null;

  const save = async () => {
    const problem = validateStep(step, answers, data);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveStep(getSupabase(), userId, step, answers, data);
      await query.refetch();
      // Answers feed matching, so every list may change.
      for (const key of ['feed', 'rooms', 'likes-you', 'matches']) queryClient.invalidateQueries({ queryKey: [key, userId] });
      // Switching to "I have a place" makes the profile incomplete until the listing is added; the
      // root navigator then sends the user to onboarding, which resumes at the listing.
      if (router.canGoBack()) router.back();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen header={<BackHeader title={copy.title} subtitle={copy.subtitle} />} scroll={false} edges={{ top: true, bottom: true }}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <StepContent
          step={step}
          answers={answers}
          update={(patch) => setAnswers((a) => (a ? { ...a, ...patch } : a))}
          userId={userId}
          data={data}
          refresh={() => query.refetch()}
          onBusyChange={setBusy}
        />
      </ScrollView>
      <View className="gap-2 pt-3">
        {warning ? (
          <Text variant="caption" tone="muted">
            {warning}
          </Text>
        ) : null}
        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button label="Save" fullWidth loading={saving} disabled={busy} onPress={save} />
      </View>
    </Screen>
  );
}
