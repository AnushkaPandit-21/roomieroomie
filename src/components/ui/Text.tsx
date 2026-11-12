import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography, type ColorToken, type TypographyVariant } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';

export type TextTone = 'default' | 'muted' | 'subtle' | 'brand' | 'accent' | 'inverse' | 'danger';

const toneColor: Record<TextTone, ColorToken> = {
  default: 'ink',
  muted: 'ink-muted',
  subtle: 'ink-subtle',
  brand: 'brand',
  accent: 'accent',
  inverse: 'on-brand',
  danger: 'danger',
};

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', tone = 'default', align, style, children, ...rest }: TextProps) {
  const { typeScale } = useResponsive();
  const spec = typography[variant];

  return (
    <RNText
      maxFontSizeMultiplier={1.4}
      style={[
        {
          fontFamily: spec.fontFamily,
          fontSize: Math.round(spec.fontSize * typeScale),
          lineHeight: Math.round(spec.lineHeight * typeScale),
          letterSpacing: 'letterSpacing' in spec ? spec.letterSpacing : undefined,
          textTransform: 'uppercase' in spec && spec.uppercase ? 'uppercase' : undefined,
          color: colors[toneColor[tone]],
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
