import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { colors } from '@/constants/theme';
import { cn } from '@/utils/cn';
import { formatDisplayDate, parseISODate, toISODate } from '@/utils/date';

import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';

type DateFieldProps = {
  label?: string;
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  // Where the picker opens when there is no value yet.
  initialDate?: Date;
  error?: string;
};

// Tappable field showing a date; opens the native dialog on Android and a spinner sheet on iOS.
export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Select a date',
  minimumDate,
  maximumDate,
  initialDate,
  error,
}: DateFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosValue, setIosValue] = useState<Date>(new Date());
  const current = value ? parseISODate(value) : (initialDate ?? new Date());

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toISODate(date));
        },
      });
    } else {
      setIosValue(current);
      setIosOpen(true);
    }
  };

  return (
    <View className="w-full">
      {label ? (
        <Text variant="label" tone="muted" style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={label ?? placeholder}>
        {({ pressed }) => (
          <View
            className={cn(
              'min-h-[52px] flex-row items-center justify-between rounded-lg border bg-surface px-4',
              error ? 'border-danger' : 'border-line',
              pressed && 'bg-surface-muted',
            )}
          >
            <Text tone={value ? 'default' : 'subtle'}>{value ? formatDisplayDate(value) : placeholder}</Text>
            <Icon name="calendar-outline" size={20} color="ink-muted" />
          </View>
        )}
      </Pressable>
      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : null}

      {Platform.OS === 'ios' ? (
        <Sheet
          visible={iosOpen}
          onClose={() => setIosOpen(false)}
          title={label ?? 'Select a date'}
          footer={
            <Button
              label="Done"
              fullWidth
              onPress={() => {
                onChange(toISODate(iosValue));
                setIosOpen(false);
              }}
            />
          }
        >
          <DateTimePicker
            value={iosValue}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            textColor={colors.ink}
            onChange={(_, date) => date && setIosValue(date)}
          />
        </Sheet>
      ) : null}
    </View>
  );
}
