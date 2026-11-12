import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { clamp } from '@/utils/math';

type ProgressBarProps = {
  progress: number;
};

export function ProgressBar({ progress }: ProgressBarProps) {
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withTiming(clamp(progress, 0, 1), { duration: 300 });
  }, [progress, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-muted"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(progress, 0, 1) * 100) }}
    >
      <Animated.View className="h-full rounded-pill bg-brand" style={fillStyle} />
    </View>
  );
}
