import { useQuery } from '@tanstack/react-query';

import { getSupabase } from '@/services/supabase';

import { loadOnboarding } from './api';

export const onboardingKey = (userId: string | undefined) => ['onboarding', userId] as const;

export function useOnboardingData(userId: string | undefined) {
  return useQuery({
    queryKey: onboardingKey(userId),
    queryFn: () => loadOnboarding(getSupabase(), userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });
}
