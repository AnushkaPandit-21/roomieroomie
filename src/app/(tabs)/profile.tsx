import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, Switch, View } from 'react-native';

import { Screen, ScreenHeader } from '@/components/layout';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { Button, Card, Icon, Text, type IconName } from '@/components/ui';
import { colors } from '@/constants/theme';
import { signOut } from '@/features/auth/signOut';
import { onboardingKey, useOnboardingData } from '@/features/onboarding/useOnboardingData';
import { deleteAccount, setPaused } from '@/features/profile/api';
import { cardFromOnboarding } from '@/features/profile/preview';
import { useProfilePhotoUrls } from '@/hooks/usePhotoUrls';
import { friendlyError } from '@/services/errors';
import { pushUnavailableReason } from '@/services/push';
import { getSupabase } from '@/services/supabase';
import { useSessionStore } from '@/stores/sessionStore';

function Row({ icon, label, detail, onPress, right, tone }: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress?: () => void;
  right?: ReactNode;
  tone?: 'danger';
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      className="flex-row items-center gap-4 py-3.5 active:opacity-70"
    >
      <Icon name={icon} size={22} color={tone === 'danger' ? 'danger' : 'ink'} />
      <View className="flex-1">
        <Text variant="bodyStrong" tone={tone === 'danger' ? 'danger' : 'default'}>
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" tone="muted">
            {detail}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} color="ink-subtle" /> : null)}
    </Pressable>
  );
}

// Profile preview, edit, pause, settings, sign out and account deletion (CLAUDE.md §2, §10).
export default function ProfileScreen() {
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const queryClient = useQueryClient();
  const query = useOnboardingData(userId);
  const data = query.data;
  const me = data ? cardFromOnboarding(data) : null;
  const urls = useProfilePhotoUrls(me).data ?? {};
  const [pausing, setPausing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const paused = data?.profile?.is_paused ?? false;
  const pushNote = pushUnavailableReason();

  const togglePause = async (next: boolean) => {
    setPausing(true);
    try {
      await setPaused(getSupabase(), userId, next);
      await queryClient.invalidateQueries({ queryKey: onboardingKey(userId) });
    } catch (e) {
      Alert.alert('Couldn’t update', friendlyError(e));
    } finally {
      setPausing(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, photos, likes, matches and messages. It can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount(getSupabase());
              await getSupabase().auth.signOut({ scope: 'local' });
            } catch (e) {
              setDeleting(false);
              Alert.alert('Couldn’t delete your account', friendlyError(e));
            }
          },
        },
      ],
    );

  if (!data || !me) {
    return (
      <Screen header={<ScreenHeader title="Profile" />} scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title="Profile"
          right={<Button label="Edit" variant="outline" size="md" leftIcon="create-outline" onPress={() => router.push('/edit-profile')} />}
        />
      }
    >
      {paused ? (
        <Card className="mb-4" elevated={false} style={{ backgroundColor: colors['brand-soft'] }}>
          <Text variant="bodyStrong">Your profile is paused</Text>
          <Text tone="muted" variant="caption">
            New people can’t see you. Your matches and chats still work.
          </Text>
        </Card>
      ) : null}

      <Card className="mb-6" padded={false}>
        <View className="px-5">
          <Row icon="person-outline" label="Edit profile" detail="Photos, prompts, preferences and more" onPress={() => router.push('/edit-profile')} />
          {data.listing ? <Row icon="home-outline" label="Your listing" detail={`${data.listing.area} · room photos`} onPress={() => router.push('/listing/edit')} /> : null}
          <Row
            icon="pause-circle-outline"
            label="Pause my profile"
            detail="Hide from Discover, Rooms and Likes You"
            right={
              <Switch
                value={paused}
                disabled={pausing}
                onValueChange={togglePause}
                trackColor={{ true: colors.brand, false: colors['line-strong'] }}
                thumbColor={colors.surface}
                accessibilityLabel="Pause my profile"
              />
            }
          />
          <Row icon="notifications-outline" label="Notifications" detail={pushNote ?? 'New likes, matches and messages'} />
          <Row icon="log-out-outline" label="Sign out" onPress={() => signOut(userId)} />
          <Row icon="trash-outline" label={deleting ? 'Deleting…' : 'Delete account'} tone="danger" onPress={deleting ? undefined : confirmDelete} />
          {__DEV__ ? (
            <Row icon="color-palette-outline" label="Design system (dev only)" onPress={() => router.push('/design-system')} />
          ) : null}
        </View>
      </Card>

      <Text variant="label" tone="muted" style={{ marginBottom: 12 }}>
        How others see you
      </Text>
      <ProfileCard profile={me} photoUrls={urls} />
    </Screen>
  );
}
