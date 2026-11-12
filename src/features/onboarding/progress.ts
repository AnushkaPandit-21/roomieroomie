import { stepsFor } from './steps';
import type { SeekingType } from '@/types/domain';

// Phone OTP counts as step 1 of the onboarding progress bar.
export function progressFor(stepIndex: number, seeking: SeekingType | null): number {
  const total = 1 + stepsFor(seeking).length;
  return (stepIndex + 1) / total;
}

export const AUTH_PROGRESS = progressFor(0, null);
