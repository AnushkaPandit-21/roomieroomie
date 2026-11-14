import {
  CLEANLINESS_OPTIONS,
  DEALBREAKER_LABELS,
  DRINKING_OPTIONS,
  FOOD_OPTIONS,
  GENDER_OPTIONS,
  GUESTS_OPTIONS,
  PETS_OPTIONS,
  RELIGION_OPTIONS,
  SEEKING_OPTIONS,
  SLEEP_OPTIONS,
  SMOKING_OPTIONS,
  type Option,
} from '@/features/onboarding/options';
import { countPhotos, type StepId } from '@/features/onboarding/steps';
import type { Answers, OnboardingData } from '@/features/onboarding/types';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/format';

// Edit profile sections. Order follows onboarding (CLAUDE.md §3); listing is edited separately.
export const EDIT_SECTIONS: { title: string; steps: { step: StepId; label: string }[] }[] = [
  {
    title: 'Profile',
    steps: [
      { step: 'photos', label: 'Photos' },
      { step: 'prompts', label: 'Prompts' },
      { step: 'name_dob', label: 'Name & date of birth' },
      { step: 'occupation', label: 'What you do' },
    ],
  },
  {
    title: 'Who you’re looking for',
    steps: [
      { step: 'gender', label: 'Your gender' },
      { step: 'want_genders', label: 'Who you want to live with' },
      { step: 'show_to_genders', label: 'Who can see you' },
      { step: 'city_areas', label: 'City & areas' },
      { step: 'seeking_type', label: 'Looking for a place / have a place' },
      { step: 'max_budget', label: 'Maximum budget' },
      { step: 'household_budget', label: 'Household expenses budget' },
      { step: 'move_in_date', label: 'Move-in date' },
    ],
  },
  {
    title: 'Lifestyle',
    steps: [
      { step: 'food', label: 'Food' },
      { step: 'smoking', label: 'Smoking' },
      { step: 'drinking', label: 'Drinking' },
      { step: 'sleep', label: 'Sleep schedule' },
      { step: 'cleanliness', label: 'Tidiness' },
      { step: 'guests', label: 'Guests' },
      { step: 'pets', label: 'Pets' },
      { step: 'languages', label: 'Languages' },
      { step: 'religion', label: 'Religion' },
      { step: 'dealbreakers', label: 'Dealbreakers' },
    ],
  },
];

const label = <T,>(options: Option<T>[], value: T | null) => options.find((o) => o.value === value)?.label ?? 'Not set';
const labels = <T,>(options: Option<T>[], values: T[]) =>
  values.length ? values.map((v) => label(options, v)).join(', ') : 'Not set';

// One-line current answer for a row in Edit profile.
export function summarize(step: StepId, a: Answers, data: OnboardingData): string {
  switch (step) {
    case 'photos':
      return `${countPhotos(data, false)} photos`;
    case 'room_photos':
      return `${countPhotos(data, true)} room photos`;
    case 'prompts':
      return `${a.prompts.filter((p) => p.answer.trim()).length} of 3 answered`;
    case 'name_dob':
      return a.dob ? `${a.name} · ${formatDisplayDate(a.dob)}` : a.name;
    case 'occupation':
      return a.occupation || 'Not set';
    case 'gender':
      return label(GENDER_OPTIONS, a.gender);
    case 'want_genders':
      return labels(GENDER_OPTIONS, a.want_genders);
    case 'show_to_genders':
      return labels(GENDER_OPTIONS, a.show_to_genders);
    case 'city_areas':
      return a.city ? `${a.city} · ${a.areas.join(', ')}` : 'Not set';
    case 'seeking_type':
      return label(SEEKING_OPTIONS, a.seeking_type);
    case 'max_budget':
      return a.max_budget != null ? formatRupees(a.max_budget) : 'Not set';
    case 'household_budget':
      return a.household_budget != null ? `${formatRupees(a.household_budget)}/mo` : 'Not set';
    case 'move_in_date':
      return a.move_in_date ? formatDisplayDate(a.move_in_date) : 'Not set';
    case 'food':
      return label(FOOD_OPTIONS, a.food);
    case 'smoking':
      return label(SMOKING_OPTIONS, a.smoking);
    case 'drinking':
      return label(DRINKING_OPTIONS, a.drinking);
    case 'sleep':
      return label(SLEEP_OPTIONS, a.sleep);
    case 'cleanliness':
      return label(CLEANLINESS_OPTIONS, a.cleanliness);
    case 'guests':
      return label(GUESTS_OPTIONS, a.guests);
    case 'pets':
      return label(PETS_OPTIONS, a.pets);
    case 'languages':
      return a.language.join(', ') || 'Not set';
    case 'religion':
      return label(RELIGION_OPTIONS, a.religion);
    case 'dealbreakers':
      return a.dealbreakers.length ? a.dealbreakers.map((d) => DEALBREAKER_LABELS[d]).join(', ') : 'None';
    case 'listing':
      return a.listing.area ?? 'Not set';
  }
}
