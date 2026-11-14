import { router } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { BackHeader, Screen } from '@/components/layout';
import { Card, Icon, Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import { answersFromData } from '@/features/onboarding/answers';
import { useOnboardingData } from '@/features/onboarding/useOnboardingData';
import { EDIT_SECTIONS, summarize } from '@/features/profile/summary';
import { useSessionStore } from '@/stores/sessionStore';

// Every onboarding answer, editable one at a time with the same screens and validation.
export default function EditProfileScreen() {
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const data = useOnboardingData(userId).data;

  if (!data) {
    return (
      <Screen header={<BackHeader title="Edit profile" />} scroll={false} edges={{ top: true, bottom: true }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  const answers = answersFromData(data);

  return (
    <Screen header={<BackHeader title="Edit profile" />} edges={{ top: true, bottom: true }}>
      <View className="gap-6">
        {EDIT_SECTIONS.map((section) => (
          <View key={section.title} className="gap-2">
            <Text variant="label" tone="muted">
              {section.title}
            </Text>
            <Card padded={false}>
              {section.steps.map(({ step, label }, i) => (
                <Pressable
                  key={step}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}: ${summarize(step, answers, data)}`}
                  onPress={() => router.push({ pathname: '/edit-profile/[step]', params: { step } })}
                  className={`flex-row items-center gap-3 px-5 py-3.5 active:opacity-70 ${i ? 'border-t border-line' : ''}`}
                >
                  <View className="flex-1">
                    <Text variant="bodyStrong">{label}</Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {summarize(step, answers, data)}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color="ink-subtle" />
                </Pressable>
              ))}
            </Card>
          </View>
        ))}
        {data.listing ? (
          <Card padded={false}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/listing/edit')}
              className="flex-row items-center gap-3 px-5 py-3.5 active:opacity-70"
            >
              <View className="flex-1">
                <Text variant="bodyStrong">Your listing</Text>
                <Text variant="caption" tone="muted">
                  Room details and room photos
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color="ink-subtle" />
            </Pressable>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
