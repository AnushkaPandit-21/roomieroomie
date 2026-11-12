import { View } from 'react-native';

import { Chip } from './Chip';
import type { OptionItem } from './OptionList';

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

// Wrapping row of selectable chips, for longer lists (areas, languages, amenities).
export function ChipGroup<T extends string | number>(props: SingleProps<T> | MultipleProps<T>) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {props.options.map((option) => {
        const selected = props.multiple ? props.value.includes(option.value) : props.value === option.value;
        return (
          <Chip
            key={String(option.value)}
            label={option.label}
            selected={selected}
            onPress={() => {
              if (props.multiple) {
                props.onChange(
                  selected ? props.value.filter((v) => v !== option.value) : [...props.value, option.value],
                );
              } else {
                props.onChange(option.value);
              }
            }}
          />
        );
      })}
    </View>
  );
}
