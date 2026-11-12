import { Pressable, View } from 'react-native';

import { cn } from '@/utils/cn';

import { Icon } from './Icon';
import { Text } from './Text';

export type OptionItem<T> = { value: T; label: string; description?: string };

type SingleProps<T> = {
  options: OptionItem<T>[];
  multiple?: false;
  value: T | null;
  onChange: (value: T) => void;
};

type MultipleProps<T> = {
  options: OptionItem<T>[];
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
};

// Full-width selectable rows: radio behaviour by default, checkboxes with `multiple`.
export function OptionList<T extends string | number>(props: SingleProps<T> | MultipleProps<T>) {
  const isSelected = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);

  const toggle = (v: T) => {
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(v);
    }
  };

  return (
    <View className="gap-3">
      {props.options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => toggle(option.value)}
            accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
            accessibilityState={props.multiple ? { checked: selected } : { selected }}
            accessibilityLabel={option.label}
          >
            {({ pressed }) => (
              <View
                className={cn(
                  'min-h-[56px] flex-row items-center rounded-lg border px-4 py-3',
                  selected ? 'border-ink bg-surface' : 'border-line bg-surface',
                  pressed && !selected && 'bg-surface-muted',
                )}
              >
                <View className="flex-1 pr-3">
                  <Text variant="bodyStrong">{option.label}</Text>
                  {option.description ? (
                    <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                      {option.description}
                    </Text>
                  ) : null}
                </View>
                <View
                  className={cn(
                    'h-6 w-6 items-center justify-center border-2',
                    props.multiple ? 'rounded-md' : 'rounded-pill',
                    selected ? 'border-ink bg-ink' : 'border-line-strong bg-surface',
                  )}
                >
                  {selected ? <Icon name="checkmark" size={16} color="on-brand" /> : null}
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
