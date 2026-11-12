import type { Database } from '@/types/database';
import type {
  DealbreakerField,
  FoodPreference,
  Gender,
  GuestsPreference,
  HabitPreference,
  PetsPreference,
  SeekingType,
  SleepSchedule,
} from '@/types/domain';

type Tables = Database['public']['Tables'];

export type ProfileRow = Tables['profiles']['Row'];
export type PreferencesRow = Tables['preferences']['Row'];
export type PhotoRow = Tables['photos']['Row'];
export type PromptRow = Tables['prompts']['Row'];
export type ListingRow = Tables['listings']['Row'];

// Everything onboarding needs from the server for one user.
export type OnboardingData = {
  profile: ProfileRow | null;
  preferences: PreferencesRow | null;
  photos: PhotoRow[];
  prompts: PromptRow[];
  listing: ListingRow | null;
};

export type PromptDraft = { question: string; answer: string };

export type ListingDraft = {
  area: string | null;
  rent: number | null;
  deposit: number | null;
  available_from: string | null;
  occupancy: number | null;
  furnished: boolean | null;
  amenities: string[];
};

// Editable answers for every onboarding question (photos are saved immediately, so not drafted).
export type Answers = {
  name: string;
  dob: string | null;
  gender: Gender | null;
  want_genders: Gender[];
  show_to_genders: Gender[];
  city: string | null;
  areas: string[];
  seeking_type: SeekingType | null;
  max_budget: number | null;
  move_in_date: string | null;
  food: FoodPreference | null;
  smoking: HabitPreference | null;
  drinking: HabitPreference | null;
  sleep: SleepSchedule | null;
  cleanliness: number | null;
  guests: GuestsPreference | null;
  pets: PetsPreference | null;
  language: string[];
  dealbreakers: DealbreakerField[];
  occupation: string;
  prompts: PromptDraft[];
  listing: ListingDraft;
};
