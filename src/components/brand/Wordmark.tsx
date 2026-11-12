import { View } from 'react-native';

import { Text } from '@/components/ui';
import { APP_NAME } from '@/constants/app';

type WordmarkProps = {
  size?: 'md' | 'lg';
};

export function Wordmark({ size = 'md' }: WordmarkProps) {
  return (
    <View className="flex-row items-end" accessibilityRole="header" accessibilityLabel={APP_NAME}>
      <Text variant={size === 'lg' ? 'display' : 'heading'}>{APP_NAME}</Text>
      <View className="mb-2 ml-1 h-2 w-2 rounded-pill bg-brand" />
    </View>
  );
}
