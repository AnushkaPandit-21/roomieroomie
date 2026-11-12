import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, ProgressBar, Text } from '@/components/ui';
import { layout } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';

type StepScaffoldProps = {
  progress: number;
  overline?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  loading?: boolean;
  error?: string | null;
};

// One onboarding question per screen: progress bar, title, body, and a Continue button.
export function StepScaffold({
  progress,
  overline,
  title,
  subtitle,
  children,
  onBack,
  onContinue,
  continueLabel = 'Continue',
  loading = false,
  error,
}: StepScaffoldProps) {
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const column = { width: '100%' as const, maxWidth: layout.contentMaxWidth, alignSelf: 'center' as const };

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 py-2" style={[column, { paddingHorizontal: gutter }]}>
        {onBack ? (
          <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={onBack} size="sm" disabled={loading} />
        ) : (
          <View className="h-9 w-9" />
        )}
        <View className="flex-1">
          <ProgressBar progress={progress} />
        </View>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={[column, { paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {overline ? (
            <Text variant="overline" tone="brand" style={{ marginBottom: 8 }}>
              {overline}
            </Text>
          ) : null}
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text tone="muted" style={{ marginTop: 8 }}>
              {subtitle}
            </Text>
          ) : null}
          <View className="mt-6">{children}</View>
        </ScrollView>

        <View
          className="border-t border-line bg-canvas"
          style={[column, { paddingHorizontal: gutter, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          {error ? (
            <Text variant="caption" tone="danger" style={{ marginBottom: 8 }} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Button label={continueLabel} fullWidth loading={loading} onPress={onContinue} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
