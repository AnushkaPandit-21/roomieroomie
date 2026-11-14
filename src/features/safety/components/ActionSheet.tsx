import { Pressable, View } from 'react-native';

import { Icon, Sheet, Text, type IconName } from '@/components/ui';

export type SheetAction = {
  label: string;
  icon: IconName;
  destructive?: boolean;
  onPress: () => void;
};

type ActionSheetProps = {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
};

// A list of actions in a bottom sheet (chat menu, profile menu).
export function ActionSheet({ visible, title, actions, onClose }: ActionSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View className="pb-2">
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            className="flex-row items-center gap-4 rounded-lg py-4 active:bg-surface-muted"
            onPress={() => {
              onClose();
              a.onPress();
            }}
          >
            <Icon name={a.icon} size={22} color={a.destructive ? 'danger' : 'ink'} />
            <Text variant="bodyStrong" tone={a.destructive ? 'danger' : 'default'}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
