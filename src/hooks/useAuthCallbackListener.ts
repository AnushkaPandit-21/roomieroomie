import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { completeSignInFromUrl, isAuthCallbackUrl } from '@/features/auth/google';

// Backup path for Google sign-in: if the OS hands the auth/callback deep link to the app directly
// (cold start, or Android closing the browser first), finish the sign-in from that URL.
export function useAuthCallbackListener() {
  useEffect(() => {
    const handle = (url: string | null) => {
      if (url && isAuthCallbackUrl(url)) {
        completeSignInFromUrl(url).catch((error) => {
          if (__DEV__) console.warn('Sign-in callback failed:', error);
        });
      }
    };

    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);
}
