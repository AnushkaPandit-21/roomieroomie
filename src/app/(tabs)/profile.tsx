import { router } from 'expo-router';

import { EmptyState, Screen, ScreenHeader } from '@/components/layout';
import { Button } from '@/components/ui';

export default function ProfileScreen() {
  return (
    <Screen header={<ScreenHeader title="Profile" />}>
      <EmptyState
        icon="person-circle-outline"
        title="Profile"
        description="Your profile preview, edit mode, preferences and settings will appear here."
        action={
          __DEV__ ? (
            <Button
              label="Design system (dev only)"
              variant="outline"
              size="md"
              leftIcon="color-palette-outline"
              onPress={() => router.push('/design-system')}
            />
          ) : null
        }
      />
    </Screen>
  );
}
