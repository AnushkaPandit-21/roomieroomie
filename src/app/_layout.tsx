import '../../global.css';

import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/layout';
import { colors } from '@/constants/theme';
import { getOnboardingStatus } from '@/features/onboarding/steps';
import { useOnboardingData } from '@/features/onboarding/useOnboardingData';
import { useAuthListener } from '@/hooks/useAuthListener';
import { queryClient } from '@/services/queryClient';
import { useSessionStore } from '@/stores/sessionStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <RootNavigator fontsReady={fontsLoaded || !!fontError} />
    </QueryClientProvider>
  );
}

// Access rules: signed out → Google sign-in; signed in but incomplete → onboarding;
// complete profile (incl. ≥ 3 photos and 3 prompts) → the five tabs.
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  useAuthListener();
  const session = useSessionStore((s) => s.session);
  const initialized = useSessionStore((s) => s.initialized);
  const configError = useSessionStore((s) => s.configError);

  const userId = session?.user.id;
  const onboarding = useOnboardingData(userId);
  const complete = onboarding.data ? getOnboardingStatus(onboarding.data).complete : false;

  const signedIn = !!session;
  const statusKnown = !signedIn || onboarding.isFetched;
  const ready = fontsReady && initialized && statusKnown;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  if (configError) {
    return (
      <View className="flex-1 bg-canvas">
        <EmptyState icon="construct-outline" title="App not configured" description={configError} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Protected guard={!signedIn} redirectTo={complete ? '/' : '/onboarding'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !complete} redirectTo={signedIn ? '/' : '/sign-in'}>
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && complete} redirectTo={signedIn ? '/onboarding' : '/sign-in'}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="design-system" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
