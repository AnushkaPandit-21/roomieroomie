import { Pressable, View, type PressableProps } from 'react-native';

import { shadow, type ColorToken } from '@/constants/theme';
import { cn } from '@/utils/cn';

import { Icon, type IconName } from './Icon';

type IconButtonVariant = 'plain' | 'surface' | 'brand';
type IconButtonSize = 'sm' | 'md' | 'lg';

const sizePx: Record<IconButtonSize, { box: number; icon: number }> = {
  sm: { box: 36, icon: 18 },
  md: { box: 44, icon: 22 },
  lg: { box: 64, icon: 30 },
};

const variantClass: Record<IconButtonVariant, string> = {
  plain: 'bg-transparent',
  surface: 'bg-surface border border-line',
  brand: 'bg-brand',
};

const variantIconColor: Record<IconButtonVariant, ColorToken> = {
  plain: 'ink',
  surface: 'ink',
  brand: 'on-brand',
};

export type IconButtonProps = Omit<PressableProps, 'children'> & {
  icon: IconName;
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  floating?: boolean;
  iconColor?: ColorToken;
};

export function IconButton({
  icon,
  variant = 'plain',
  size = 'md',
  floating = false,
  iconColor,
  disabled,
  ...rest
}: IconButtonProps) {
  const { box, icon: iconSize } = sizePx[size];

  return (
    <Pressable accessibilityRole="button" disabled={disabled} hitSlop={8} {...rest}>
      {({ pressed }) => (
        <View
          className={cn(
            'items-center justify-center rounded-pill',
            variantClass[variant],
            pressed && 'opacity-70',
            disabled && 'opacity-40',
          )}
          style={[{ width: box, height: box }, floating && shadow.floating]}
        >
          <Icon name={icon} size={iconSize} color={iconColor ?? variantIconColor[variant]} />
        </View>
      )}
    </Pressable>
  );
}
