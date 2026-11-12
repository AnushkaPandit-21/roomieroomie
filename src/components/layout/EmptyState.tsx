import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <View className="mb-5 h-20 w-20 items-center justify-center rounded-pill bg-brand-soft">
        <Icon name={icon} size={34} color="brand" />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {description ? (
        <Text tone="muted" align="center" style={{ marginTop: 8, maxWidth: 320 }}>
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-6">{action}</View> : null}
    </View>
  );
}
