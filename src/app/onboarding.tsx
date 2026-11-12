import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, View } from 'react-native';

import { EmptyState } from '@/components/layout';
import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';
import { answersFromData, mergeDraft } from '@/features/onboarding/answers';
import { saveStep } from '@/features/onboarding/api';
import { StepContent } from '@/features/onboarding/components/StepContent';
import { StepScaffold } from '@/features/onboarding/components/StepScaffold';
import { STEP_COPY } from '@/features/onboarding/copy';
import { progressFor } from '@/features/onboarding/progress';
import { getOnboardingStatus, stepsFor, type StepId } from '@/features/onboarding/steps';
import { useOnboardingData } from '@/features/onboarding/useOnboardingData';
import { validateStep } from '@/features/onboarding/validation';
import { friendlyError } from '@/services/errors';
import { getSupabase } from '@/services/supabase';
import { useDraftHydrated, useOnboardingDraft } from '@/stores/onboardingDraftStore';
import { useSessionStore } from '@/stores/sessionStore';

function confirmSignOut() {
  Alert.alert('Use a different number?', 'You’ll be signed out. Your answers so far are saved.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => getSupabase().auth.signOut() },
  ]);
}

export default function OnboardingScreen() {
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const query = useOnboardingData(userId);
  const hydrated = useDraftHydrated();
  const answers = useOnboardingDraft((s) => s.answers);
  const update = useOnboardingDraft((s) => s.update);

  const [step, setStep] = useState<StepId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Restore: server answers + any unsaved local draft, then resume at the first unanswered step.
  useEffect(() => {
    if (!query.data || !hydrated || step) return;
    const draft = useOnboardingDraft.getState();
    const local = draft.userId === userId ? draft.answers : null;
    draft.setAll(userId, mergeDraft(answersFromData(query.data), local));
    setStep(getOnboardingStatus(query.data).resumeStep);
  }, [query.data, hydrated, step, userId]);

  const steps = stepsFor(answers.seeking_type);
  const index = step ? Math.max(steps.indexOf(step), 0) : 0;

  const goBack = useCallback(() => {
    if (saving) return;
    setError(null);
    if (index === 0) confirmSignOut();
    else setStep(steps[index - 1]);
  }, [index, saving, steps]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [goBack]);

  const onContinue = async () => {
    if (!step || !query.data) return;
    if (uploading) {
      setError('Wait for your photos to finish uploading.');
      return;
    }
    const message = validateStep(step, answers, query.data);
    if (message) {
      setError(message);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await saveStep(getSupabase(), userId, step, answers, query.data);
      const { data: fresh } = await query.refetch({ throwOnError: true });
      const next = steps[index + 1];
      if (next) {
        setStep(next);
      } else if (fresh && getOnboardingStatus(fresh).complete) {
        // The root navigator sees the completed profile and opens the tabs.
        useOnboardingDraft.getState().clear();
      } else if (fresh) {
        setStep(getOnboardingStatus(fresh).resumeStep);
        setError('A few answers are still missing.');
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  if (query.isError && !query.data) {
    return (
      <View className="flex-1 bg-canvas">
        <EmptyState
          icon="cloud-offline-outline"
          title="We couldn’t load your profile"
          description={friendlyError(query.error)}
          action={
            <View className="gap-3">
              <Button label="Try again" onPress={() => query.refetch()} />
              <Button label="Sign out" variant="ghost" onPress={() => getSupabase().auth.signOut()} />
            </View>
          }
        />
      </View>
    );
  }

  if (!step || !query.data) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const copy = STEP_COPY[step];

  return (
    <StepScaffold
      key={step}
      progress={progressFor(index + 1, answers.seeking_type)}
      overline={copy.overline}
      title={copy.title}
      subtitle={copy.subtitle}
      onBack={goBack}
      onContinue={onContinue}
      continueLabel={index === steps.length - 1 ? 'Finish' : 'Continue'}
      loading={saving}
      error={error}
    >
      <StepContent
        step={step}
        answers={answers}
        update={(patch) => {
          setError(null);
          update(patch);
        }}
        userId={userId}
        data={query.data}
        refresh={() => query.refetch()}
        onBusyChange={setUploading}
      />
    </StepScaffold>
  );
}
