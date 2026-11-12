import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { colors, type ColorToken } from '@/constants/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  color?: ColorToken;
};

export function Icon({ name, size = 22, color = 'ink' }: IconProps) {
  return <Ionicons name={name} size={size} color={colors[color]} />;
}
