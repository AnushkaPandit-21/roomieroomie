import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';

type ScreenProps = {
  children: ReactNode;
  header?: ReactNode;
  scroll?: boolean;
  // Tab screens sit above the tab bar, which already pads for the bottom inset.
  edges?: { top?: boolean; bottom?: boolean };
};

// Applies safe areas, responsive gutters and a max content width so tablets get a centred column.
export function Screen({ children, header, scroll = true, edges = { top: true, bottom: false } }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();

  const column = { width: '100%' as const, maxWidth: layout.contentMaxWidth, alignSelf: 'center' as const };
  const bottomPad = (edges.bottom ? insets.bottom : 0) + 24;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: edges.top ? insets.top : 0 }}>
      {header ? <View style={[column, { paddingHorizontal: gutter }]}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={[column, { paddingHorizontal: gutter, paddingBottom: bottomPad, flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1" style={[column, { paddingHorizontal: gutter, paddingBottom: bottomPad }]}>
          {children}
        </View>
      )}
    </View>
  );
}
