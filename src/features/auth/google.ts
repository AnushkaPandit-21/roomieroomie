import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getSupabase } from '@/services/supabase';
import { getUrlParams } from '@/utils/url';

// Path the browser returns to. Supabase must allow it under Auth → URL Configuration → Redirect URLs
// (exp://** for Expo Go, roomieroomie://** for builds).
export const AUTH_CALLBACK_PATH = 'auth/callback';

export class SignInCancelled extends Error {}

// Inside Expo Go the app can only be reopened through Expo Go's own link: exp://<dev server>/--/…
// (exps:// when the dev server is reached over https, e.g. `expo start --tunnel`). Expo Go never
// registers roomieroomie://, so a browser sent there just keeps loading. Detect Expo Go by its native
// module and build the link from Expo Go's own linking URI (or the dev server address), instead of
// Linking.createURL's environment detection, which was observed producing roomieroomie:// in Expo Go.
// In real builds this falls back to roomieroomie://auth/callback.
function expoGoRedirectUrl(): string | null {
  if (!isRunningInExpoGo()) return null;
  const linkingUri = Constants.linkingUri ?? '';
  if (/^exps?:\/\//.test(linkingUri)) {
    const base = linkingUri.includes('/--/') ? linkingUri : `${linkingUri.replace(/\/$/, '')}/--/`;
    return `${base.replace(/\/$/, '')}/${AUTH_CALLBACK_PATH}`;
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const scheme = /\.exp\.direct(:\d+)?$/.test(hostUri) ? 'exps' : 'exp';
    return `${scheme}://${hostUri}/--/${AUTH_CALLBACK_PATH}`;
  }
  return null;
}

export function getAuthRedirectUrl(): string {
  return expoGoRedirectUrl() ?? Linking.createURL(AUTH_CALLBACK_PATH);
}

// Dev-only diagnostics shown on the sign-in screen.
export function authDebugInfo(): string {
  return [
    `return: ${getAuthRedirectUrl()}`,
    `expoGo: ${isRunningInExpoGo()}`,
    `env: ${Constants.executionEnvironment}`,
    `host: ${Constants.expoConfig?.hostUri ?? 'none'}`,
    `link: ${Constants.linkingUri || 'none'}`,
  ].join(' · ');
}

export const isAuthCallbackUrl = (url: string) => url.includes(AUTH_CALLBACK_PATH);

const handledUrls = new Set<string>();

// Turns the callback URL (tokens in the fragment, or a PKCE code) into a stored session.
// Safe to call twice for the same URL: the browser result and the deep-link listener may both see it.
export async function completeSignInFromUrl(url: string): Promise<void> {
  if (handledUrls.has(url)) return;
  handledUrls.add(url);

  const client = getSupabase();
  const params = getUrlParams(url);
  if (params.error || params.error_description) {
    throw new Error(params.error_description || params.error);
  }

  if (params.code) {
    const { error } = await client.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return;
  }
  if (!params.access_token || !params.refresh_token) {
    throw new Error('Google sign-in did not return a session.');
  }
  const { error } = await client.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
  if (error) throw error;
}

// Opens Google sign-in (via Supabase) in an in-app browser and stores the returned session.
// Works in Expo Go — no native Google SDK required.
export async function signInWithGoogle(): Promise<void> {
  const client = getSupabase();
  const redirectTo = getAuthRedirectUrl();
  // Supabase rejects return addresses whose host is a bare IP (it silently falls back to the Site URL,
  // which shows "site can't be reached"). `npm run dev` serves Expo Go under <ip>.nip.io instead.
  if (__DEV__ && /^exps?:\/\/\d{1,3}(\.\d{1,3}){3}(:\d+)?\//.test(redirectTo)) {
    throw new Error('Google sign-in can’t return to Expo Go on an IP address. Stop Expo and start it with `npm run dev`.');
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    await completeSignInFromUrl(result.url);
    return;
  }
  // Some Android devices report "dismiss" even though the app received the callback;
  // useAuthCallbackListener finishes the sign-in in that case.
  throw new SignInCancelled();
}

// DEV ONLY: lets the owner use the app while Google sign-in is being set up. Creates an anonymous
// Supabase user (needs "Allow anonymous sign-ins" in the dashboard). Never shown in release builds.
export async function signInForDevelopment(): Promise<void> {
  const { error } = await getSupabase().auth.signInAnonymously();
  if (error) throw error;
}
