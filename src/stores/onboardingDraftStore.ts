import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { emptyAnswers } from '@/features/onboarding/answers';
import type { Answers } from '@/features/onboarding/types';

// Local copy of the answers being edited. Persisted so going back, or closing the app mid-step,
// never loses what was typed. Scoped to one user id so another account on the device starts clean.
type DraftState = {
  userId: string | null;
  answers: Answers;
  setAll: (userId: string, answers: Answers) => void;
  update: (patch: Partial<Answers>) => void;
  clear: () => void;
};

export const useOnboardingDraft = create<DraftState>()(
  persist(
    (set) => ({
      userId: null,
      answers: emptyAnswers(),
      setAll: (userId, answers) => set({ userId, answers }),
      update: (patch) => set((state) => ({ answers: { ...state.answers, ...patch } })),
      clear: () => set({ userId: null, answers: emptyAnswers() }),
    }),
    {
      name: 'roomieroomie.onboarding-draft',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ userId: state.userId, answers: state.answers }),
    },
  ),
);

export function useDraftHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useOnboardingDraft.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    return useOnboardingDraft.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);
  return hydrated;
}
