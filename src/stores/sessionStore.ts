import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

type SessionState = {
  session: Session | null;
  // True once the stored session has been read on launch.
  initialized: boolean;
  configError: string | null;
  setSession: (session: Session | null) => void;
  setInitialized: () => void;
  setConfigError: (message: string) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  initialized: false,
  configError: null,
  setSession: (session) => set({ session }),
  setInitialized: () => set({ initialized: true }),
  setConfigError: (configError) => set({ configError, initialized: true }),
}));
