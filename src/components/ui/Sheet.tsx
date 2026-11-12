import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';

import { IconButton } from './IconButton';
import { Text } from './Text';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height, gutter } = useResponsive();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-scrim" onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          entering={SlideInDown.duration(280)}
          className="w-full self-center rounded-t-2xl bg-canvas"
          style={{ maxHeight: height * 0.9, maxWidth: layout.contentMaxWidth + gutter * 2 }}
        >
          <View className="items-center pt-3">
            <View className="h-1 w-10 rounded-pill bg-line-strong" />
          </View>
          <View className="flex-row items-center justify-between pb-2 pt-3" style={{ paddingHorizontal: gutter }}>
            <View className="flex-1">{title ? <Text variant="heading">{title}</Text> : null}</View>
            <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} size="sm" variant="surface" />
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: footer ? 16 : insets.bottom + 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? (
            <View
              className="border-t border-line"
              style={{ paddingHorizontal: gutter, paddingTop: 12, paddingBottom: insets.bottom + 12 }}
            >
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
