import Slider from '@react-native-community/slider';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/constants/theme';

import { formatRupees } from '@/utils/format';

import { BUDGET } from '../options';

type BudgetRange = { min: number; max: number; step: number; initial: number };

type BudgetSliderProps = {
  value: number | null;
  onChange: (value: number) => void;
  range?: BudgetRange;
  accessibilityLabel?: string;
};

export function BudgetSlider({
  value,
  onChange,
  range = BUDGET,
  accessibilityLabel = 'Maximum monthly budget',
}: BudgetSliderProps) {
  const current = value ?? range.initial;

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
        minimumValue={range.min}
        maximumValue={range.max}
        step={range.step}
        value={current}
        onValueChange={onChange}
        minimumTrackTintColor={colors.brand}
        maximumTrackTintColor={colors['line-strong']}
        thumbTintColor={colors.brand}
        accessibilityLabel={accessibilityLabel}
      />
      <View className="flex-row justify-between">
        <Text variant="caption" tone="subtle">
          {formatRupees(range.min)}
        </Text>
        <Text variant="caption" tone="subtle">
          {formatRupees(range.max)}
        </Text>
      </View>
    </View>
  );
}
