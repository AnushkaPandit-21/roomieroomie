import { Pressable, View } from 'react-native';

import { cn } from '@/utils/cn';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type ChipProps = {
  label: string;
  icon?: IconName;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

// Static (no onPress) for lifestyle info rows; pressable for single/multi-select pickers.
export function Chip({ label, icon, selected = false, onPress, disabled }: ChipProps) {
  const body = (pressed: boolean) => (
    <View
      className={cn(
        'flex-row items-center self-start rounded-pill border px-3.5 py-2',
        selected ? 'border-ink bg-ink' : 'border-line bg-surface',
        pressed && !selected && 'bg-surface-muted',
        disabled && 'opacity-40',
      )}
    >
      {icon ? (
        <View className="mr-1.5">
          <Icon name={icon} size={16} color={selected ? 'on-brand' : 'ink-muted'} />
        </View>
      ) : null}
      <Text variant="label" tone={selected ? 'inverse' : 'default'}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
    >
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}
