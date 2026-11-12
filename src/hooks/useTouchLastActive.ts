import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { touchLastActive } from '@/features/feed/api';
import { getSupabase } from '@/services/supabase';

const ONE_HOUR = 60 * 60 * 1000;

// Keeps profiles.last_active_at fresh for the "active in the last 3 days" ranking boost (F5):
// on open and on return to the foreground, at most once an hour.
export function useTouchLastActive(enabled: boolean) {
  const lastTouch = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const touch = () => {
      if (Date.now() - lastTouch.current < ONE_HOUR) return;
      lastTouch.current = Date.now();
      touchLastActive(getSupabase()).catch(() => {
        lastTouch.current = 0;
      });
    };

    touch();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && touch());
    return () => sub.remove();
  }, [enabled]);
}
