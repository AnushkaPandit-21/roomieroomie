// CommonJS so tailwind.config.js and the TypeScript theme share one source of truth.

const colors = {
  canvas: '#FAF7F2',
  surface: '#FFFFFF',
  'surface-muted': '#F2EDE6',
  ink: '#1F1A17',
  'ink-muted': '#6B625B',
  'ink-subtle': '#857C75',
  line: '#E6DFD6',
  'line-strong': '#CFC6BB',
  brand: '#C2502E',
  'brand-pressed': '#A3401F',
  'brand-soft': '#F6E3DB',
  accent: '#2F5D50',
  'accent-soft': '#DCE8E3',
  danger: '#B3261E',
  'danger-soft': '#F9DEDC',
  success: '#2E7D4F',
  'on-brand': '#FFFFFF',
  scrim: 'rgba(31, 26, 23, 0.45)',
};

const fontFamily = {
  serif: 'Fraunces_600SemiBold',
  sans: 'Inter_400Regular',
  'sans-medium': 'Inter_500Medium',
  'sans-semibold': 'Inter_600SemiBold',
};

const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  pill: 999,
};

module.exports = { colors, fontFamily, radius };
