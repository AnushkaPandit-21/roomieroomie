import { View, type ViewProps } from 'react-native';

import { shadow } from '@/constants/theme';
import { cn } from '@/utils/cn';

type CardProps = ViewProps & {
  padded?: boolean;
  elevated?: boolean;
  className?: string;
};

export function Card({ padded = true, elevated = true, className, style, ...rest }: CardProps) {
  return (
    <View
      className={cn('overflow-hidden rounded-xl border border-line bg-surface', padded && 'p-5', className)}
      style={[elevated && shadow.card, style]}
      {...rest}
    />
  );
}
