import { Modal, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Button, Photo, Text } from '@/components/ui';
import { colors } from '@/constants/theme';

type MatchModalProps = {
  name: string | null;
  photoUri?: string;
  onClose: () => void;
};

// Shown when a like completes a mutual like (F2). Chat comes in a later step.
export function MatchModal({ name, photoUri, onClose }: MatchModalProps) {
  return (
    <Modal visible={!!name} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.scrim }}>
        <Animated.View entering={ZoomIn.duration(250)} className="w-full max-w-[400px] rounded-2xl bg-canvas p-6">
          <View className="mb-5 w-2/5 self-center">
            <Photo source={photoUri ? { uri: photoUri } : undefined} aspectRatio={1} rounded="pill" />
          </View>
          <Text variant="display" align="center" tone="brand">
            It’s a match!
          </Text>
          <Text tone="muted" align="center" style={{ marginTop: 8 }}>
            You and {name} liked each other. You’ll find them in Matches.
          </Text>
          <View className="mt-6">
            <Button label="Keep browsing" fullWidth onPress={onClose} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
