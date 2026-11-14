// Expo push token registration (CLAUDE.md §8). The `push` Edge Function sends the notifications.
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getSupabase } from './supabase';

let registeredToken: string | null = null;

export function pushProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

// Remote push needs a real device and an EAS project id. Expo Go on Android no longer supports
// remote push (SDK 53+), so there it only works in a development or store build.
export function pushUnavailableReason(): string | null {
  if (!Device.isDevice) return 'Push notifications need a real phone.';
  if (isRunningInExpoGo() && Platform.OS === 'android') return 'Push notifications need the installed app (not Expo Go on Android).';
  if (!pushProjectId()) return 'Push notifications aren’t set up for this build yet.';
  return null;
}

// Asks for permission (once) and stores this device's Expo push token. Returns the token, or null.
export async function registerPushToken(userId: string): Promise<string | null> {
  if (pushUnavailableReason()) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Likes, matches and messages',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: pushProjectId() });
  const { error } = await getSupabase()
    .from('push_tokens')
    .upsert({ profile_id: userId, token }, { onConflict: 'profile_id,token', ignoreDuplicates: true });
  if (error) throw error;
  registeredToken = token;
  return token;
}

// Stop sending to this phone (call while still signed in, since RLS needs the session).
export async function unregisterPushToken(userId: string): Promise<void> {
  if (!registeredToken) return;
  await getSupabase().from('push_tokens').delete().eq('profile_id', userId).eq('token', registeredToken);
  registeredToken = null;
}
