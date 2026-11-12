import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-end justify-between pb-4 pt-3">
      <View className="flex-1 pr-3">
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View className="flex-row items-center gap-2">{right}</View> : null}
    </View>
  );
}
