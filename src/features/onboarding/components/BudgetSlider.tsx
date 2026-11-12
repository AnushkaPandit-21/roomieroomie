import Slider from '@react-native-community/slider';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/constants/theme';

import { BUDGET } from '../options';

export function formatRupees(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

type BudgetSliderProps = {
  value: number | null;
  onChange: (value: number) => void;
};

export function BudgetSlider({ value, onChange }: BudgetSliderProps) {
  const current = value ?? BUDGET.initial;

  return (
    <View>
      <Text variant="display" align="center" accessibilityLiveRegion="polite">
        {formatRupees(current)}
      </Text>
      <Text tone="muted" align="center">
        per month
      </Text>
      <Slider
        style={{ width: '100%', height: 48, marginTop: 24 }}
        minimumValue={BUDGET.min}
        maximumValue={BUDGET.max}
        step={BUDGET.step}
        value={current}
        onValueChange={onChange}
        minimumTrackTintColor={colors.brand}
        maximumTrackTintColor={colors['line-strong']}
        thumbTintColor={colors.brand}
        accessibilityLabel="Maximum monthly budget"
      />
      <View className="flex-row justify-between">
        <Text variant="caption" tone="subtle">
          {formatRupees(BUDGET.min)}
        </Text>
        <Text variant="caption" tone="subtle">
          {formatRupees(BUDGET.max)}
        </Text>
      </View>
    </View>
  );
}
