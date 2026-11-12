import { useWindowDimensions } from 'react-native';

import { breakpoints, layout } from '@/constants/theme';
import { clamp } from '@/utils/math';

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isCompact = width < breakpoints.compact;
  const isTablet = width >= breakpoints.tablet;

  // Gentle type scaling around a 390pt-wide phone; clamped so text never balloons on tablets.
  const typeScale = clamp(width / layout.baseWidth, 0.92, 1.1);
  const gutter = isCompact ? 16 : isTablet ? 32 : 20;
  const contentWidth = Math.min(width - gutter * 2, layout.contentMaxWidth);

  return { width, height, isCompact, isTablet, typeScale, gutter, contentWidth };
}
