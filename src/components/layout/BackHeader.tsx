import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { IconButton, Text } from '@/components/ui';

type BackHeaderProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
};

// Header for pushed screens (profile details, chat): back button, title, optional actions.
export function BackHeader({ title, subtitle, right, onBack }: BackHeaderProps) {
  return (
    <View className="flex-row items-center gap-2 pb-3 pt-2">
      <IconButton
        icon="chevron-back"
        accessibilityLabel="Back"
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      />
      <View className="flex-1">
        <Text variant="subheading" numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View className="flex-row items-center gap-1">{right}</View> : null}
    </View>
  );
}
