import { useEffect } from 'react';

import { queryClient } from '@/services/queryClient';
import { getSupabase } from '@/services/supabase';
import { useOnboardingDraft } from '@/stores/onboardingDraftStore';
import { useSessionStore } from '@/stores/sessionStore';

// Keeps the session store in sync with Supabase Auth for the lifetime of the app.
export function useAuthListener() {
  useEffect(() => {
    const { setSession, setInitialized, setConfigError } = useSessionStore.getState();

    let client: ReturnType<typeof getSupabase>;
    try {
      client = getSupabase();
    } catch (error) {
      setConfigError((error as Error).message);
      return;
    }

    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitialized();
    });

    const { data } = client.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        useOnboardingDraft.getState().clear();
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);
}
