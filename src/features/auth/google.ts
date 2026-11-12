import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getSupabase } from '@/services/supabase';
import { getUrlParams } from '@/utils/url';

// Path the browser returns to. Supabase must allow it under Auth → URL Configuration → Redirect URLs
// (exp://** for Expo Go, roomieroomie://** for builds).
export const AUTH_CALLBACK_PATH = 'auth/callback';

export class SignInCancelled extends Error {}

// Opens Google sign-in (via Supabase) in an in-app browser and stores the returned session.
// Works in Expo Go — no native Google SDK required.
export async function signInWithGoogle(): Promise<void> {
  const client = getSupabase();
  const redirectTo = Linking.createURL(AUTH_CALLBACK_PATH);

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new SignInCancelled();

  const params = getUrlParams(result.url);
  if (params.error || params.error_description) {
    throw new Error(params.error_description || params.error);
  }

  if (params.code) {
    const exchanged = await client.auth.exchangeCodeForSession(params.code);
    if (exchanged.error) throw exchanged.error;
    return;
  }

  if (!params.access_token || !params.refresh_token) {
    throw new Error('Google sign-in did not return a session.');
  }
  const session = await client.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
  if (session.error) throw session.error;
}
