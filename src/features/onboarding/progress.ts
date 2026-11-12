import { stepsFor } from './steps';
import type { SeekingType } from '@/types/domain';

// Sign-in counts as step 1 of the onboarding progress bar.
export function progressFor(stepIndex: number, seeking: SeekingType | null): number {
  const total = 1 + stepsFor(seeking).length;
  return (stepIndex + 1) / total;
}
