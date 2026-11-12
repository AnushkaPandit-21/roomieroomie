import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';

import { colors, type ColorToken } from '@/constants/theme';
import { cn } from '@/utils/cn';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'lg';

const containerClass: Record<ButtonVariant, string> = {
  primary: 'bg-brand',
  secondary: 'bg-ink',
  outline: 'bg-surface border border-line-strong',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
};

const pressedClass: Record<ButtonVariant, string> = {
  primary: 'bg-brand-pressed',
  secondary: 'bg-ink-muted',
  outline: 'bg-surface-muted border border-line-strong',
  ghost: 'bg-surface-muted',
  danger: 'bg-danger',
};

const contentColor: Record<ButtonVariant, ColorToken> = {
  primary: 'on-brand',
  secondary: 'on-brand',
  outline: 'ink',
  ghost: 'ink',
  danger: 'on-brand',
};

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
};

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  leftIcon,
  loading = false,
  fullWidth = false,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const tint = contentColor[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={6}
      {...rest}
    >
      {({ pressed }) => (
        <View
          className={cn(
            'flex-row items-center justify-center rounded-pill',
            size === 'lg' ? 'min-h-[52px] px-6' : 'min-h-[40px] px-4',
            fullWidth && 'w-full',
            pressed && !isDisabled ? pressedClass[variant] : containerClass[variant],
            isDisabled && 'opacity-50',
            className,
          )}
        >
          {loading ? (
            <ActivityIndicator color={colors[tint]} />
          ) : (
            <>
              {leftIcon ? (
                <View className="mr-2">
                  <Icon name={leftIcon} size={size === 'lg' ? 20 : 18} color={tint} />
                </View>
              ) : null}
              <Text variant={size === 'lg' ? 'bodyStrong' : 'label'} style={{ color: colors[tint] }}>
                {label}
              </Text>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}
