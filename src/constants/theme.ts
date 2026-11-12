import tokens from './tokens';

export const colors = tokens.colors;
export const fonts = tokens.fontFamily;
export const radius = tokens.radius;

export type ColorToken = keyof typeof colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

type TextStyleSpec = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  uppercase?: boolean;
};

export const typography = {
  display: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 28 },
  subheading: { fontFamily: fonts['sans-semibold'], fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts['sans-semibold'], fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts['sans-medium'], fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts['sans-semibold'], fontSize: 12, lineHeight: 16, letterSpacing: 0.8, uppercase: true },
} satisfies Record<string, TextStyleSpec>;

export type TypographyVariant = keyof typeof typography;

export const shadow = {
  card: {
    shadowColor: '#1F1A17',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#1F1A17',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

export const breakpoints = {
  compact: 360,
  tablet: 768,
} as const;

export const layout = {
  contentMaxWidth: 560,
  baseWidth: 390,
} as const;
