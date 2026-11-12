import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/brand/Wordmark';
import { Button, Text } from '@/components/ui';
import { layout } from '@/constants/theme';
import { SignInCancelled, signInWithGoogle } from '@/features/auth/google';
import { useResponsive } from '@/hooks/useResponsive';
import { friendlyError } from '@/services/errors';

// Step 1 of onboarding: sign in. After a session exists the root navigator moves on.
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      if (!(e instanceof SignInCancelled)) setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      className="flex-1 bg-canvas"
      style={{ paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 8, paddingHorizontal: gutter }}
    >
      <View className="w-full flex-1 justify-center self-center" style={{ maxWidth: layout.contentMaxWidth }}>
        <Wordmark size="lg" />
        <Text variant="heading" style={{ marginTop: 16 }}>
          Find a roommate you’ll actually like living with.
        </Text>
        <Text tone="muted" style={{ marginTop: 12 }}>
          Flats and PGs across Indian cities, matched on budget, area and lifestyle.
        </Text>
      </View>

      <View className="w-full gap-3 self-center" style={{ maxWidth: layout.contentMaxWidth }}>
        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button
          label="Continue with Google"
          variant="outline"
          leftIcon="logo-google"
          fullWidth
          loading={loading}
          onPress={signIn}
        />
        <Text variant="caption" tone="subtle" align="center">
          You must be 18 or older to use RoomieRoomie.
        </Text>
      </View>
    </View>
  );
}
