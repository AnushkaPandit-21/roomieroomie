import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/utils/cn';

import { Text } from './Text';

export type InputProps = TextInputProps & {
  label?: string;
  helper?: string;
  error?: string;
};

export function Input({ label, helper, error, multiline, onFocus, onBlur, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const { typeScale } = useResponsive();

  return (
    <View className="w-full">
      {label ? (
        <Text variant="label" tone="muted" style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        multiline={multiline}
        placeholderTextColor={colors['ink-subtle']}
        selectionColor={colors.brand}
        maxFontSizeMultiplier={1.4}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={cn(
          'rounded-lg border bg-surface px-4',
          multiline ? 'min-h-[120px] py-3' : 'min-h-[52px] py-3',
          error ? 'border-danger' : focused ? 'border-ink' : 'border-line',
        )}
        style={[
          {
            fontFamily: fonts.sans,
            fontSize: Math.round(16 * typeScale),
            color: colors.ink,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
      {error || helper ? (
        <Text variant="caption" tone={error ? 'danger' : 'subtle'} style={{ marginTop: 6 }}>
          {error ?? helper}
        </Text>
      ) : null}
    </View>
  );
}
