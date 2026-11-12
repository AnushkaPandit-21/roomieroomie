// Onboarding order — CLAUDE.md §3. Phone OTP (step 1) happens on the auth screens before these.
// Lifestyle is shown one question per screen. Listing + room photos only for have_place users.
import type { SeekingType } from '@/types/domain';

import { PHOTO_LIMITS, ROOM_PHOTO_LIMITS } from './options';
import type { OnboardingData } from './types';

export const STEP_IDS = [
  'name_dob',
  'gender',
  'want_genders',
  'show_to_genders',
  'city_areas',
  'seeking_type',
  'max_budget',
  'move_in_date',
  'food',
  'smoking',
  'drinking',
  'sleep',
  'cleanliness',
  'guests',
  'pets',
  'languages',
  'dealbreakers',
  'occupation',
  'photos',
  'prompts',
  'listing',
  'room_photos',
] as const;

export type StepId = (typeof STEP_IDS)[number];

const HOST_ONLY: readonly StepId[] = ['listing', 'room_photos'];

export const LIFESTYLE_STEPS: readonly StepId[] = [
  'food', 'smoking', 'drinking', 'sleep', 'cleanliness', 'guests', 'pets', 'languages',
];

export function stepsFor(seeking: SeekingType | null | undefined): StepId[] {
  return STEP_IDS.filter((id) => seeking === 'have_place' || !HOST_ONLY.includes(id));
}

export function countPhotos(data: OnboardingData, room: boolean): number {
  return data.photos.filter((p) => p.is_room_photo === room).length;
}

// Whether the server already holds a valid answer for a step.
export function isStepDone(step: StepId, data: OnboardingData): boolean {
  const { profile: p, preferences: pr } = data;
  switch (step) {
    case 'name_dob':
      return !!p?.name && !!p?.dob;
    case 'gender':
      return !!p?.gender;
    case 'want_genders':
      return (p?.want_genders.length ?? 0) > 0;
    case 'show_to_genders':
      return (p?.show_to_genders.length ?? 0) > 0;
    case 'city_areas':
      return !!p?.city && (p?.areas.length ?? 0) > 0;
    case 'seeking_type':
      return !!p?.seeking_type;
    case 'max_budget':
      return p?.max_budget != null;
    case 'move_in_date':
      return !!p?.move_in_date;
    case 'food':
      return pr?.food != null;
    case 'smoking':
      return pr?.smoking != null;
    case 'drinking':
      return pr?.drinking != null;
    case 'sleep':
      return pr?.sleep != null;
    case 'cleanliness':
      return pr?.cleanliness != null;
    case 'guests':
      return pr?.guests != null;
    case 'pets':
      return pr?.pets != null;
    case 'languages':
      return (pr?.language.length ?? 0) > 0;
    case 'dealbreakers':
      // Optional: having none is a valid answer.
      return pr != null;
    case 'occupation':
      return !!p?.occupation?.trim();
    case 'photos':
      return countPhotos(data, false) >= PHOTO_LIMITS.min;
    case 'prompts':
      return [1, 2, 3].every((pos) => data.prompts.some((q) => q.position === pos));
    case 'listing':
      return data.listing != null;
    case 'room_photos':
      return countPhotos(data, true) >= ROOM_PHOTO_LIMITS.min;
  }
}

export type OnboardingStatus = {
  complete: boolean;
  steps: StepId[];
  // First unanswered step; where a returning user resumes.
  resumeStep: StepId;
};

export function getOnboardingStatus(data: OnboardingData): OnboardingStatus {
  const steps = stepsFor(data.profile?.seeking_type);
  const firstMissing = steps.find((s) => !isStepDone(s, data));
  return {
    complete: firstMissing === undefined,
    steps,
    resumeStep: firstMissing ?? steps[steps.length - 1],
  };
}
